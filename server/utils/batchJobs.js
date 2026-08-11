const path = require("path");
const fs = require("fs");
const { randomUUID } = require("crypto");
const archiver = require("archiver");

const BATCH_DIR = path.join(__dirname, "../downloads/batch");
const JOB_TTL_MS = 2 * 60 * 60 * 1000; // keep zip ~2h
const CONCURRENCY = Math.max(
  1,
  Math.min(4, Number(process.env.BATCH_CONCURRENCY) || 2),
);

/** @type {Map<string, object>} */
const jobs = new Map();

function ensureBatchDir() {
  if (!fs.existsSync(BATCH_DIR)) {
    fs.mkdirSync(BATCH_DIR, { recursive: true });
  }
}

function publicJob(job) {
  if (!job) return null;
  const succeeded = job.succeeded || 0;
  const failed = job.failed || 0;
  const processed = succeeded + failed;
  return {
    id: job.id,
    status: job.status,
    total: job.total,
    succeeded,
    failed,
    completed: processed,
    currentTitle: job.currentTitle,
    zipName: job.zipName,
    format: job.format,
    errors: job.errors.slice(0, 20),
    error: job.error,
    createdAt: job.createdAt,
    readyAt: job.readyAt,
    downloadUrl:
      job.status === "ready" ? `/api/download/batch/jobs/${job.id}/file` : null,
  };
}

function getJob(jobId) {
  return jobs.get(jobId) || null;
}

function deleteJobFiles(job) {
  if (!job) return;
  for (const file of job.trackFiles || []) {
    fs.promises.unlink(file.path).catch(() => {});
  }
  if (job.zipPath) {
    fs.promises.unlink(job.zipPath).catch(() => {});
  }
}

function deleteJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) return false;
  job.cancelled = true;
  deleteJobFiles(job);
  jobs.delete(jobId);
  return true;
}

function sweepExpiredJobs() {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    const anchor = job.readyAt || job.createdAt;
    if (now - anchor > JOB_TTL_MS) {
      deleteJobFiles(job);
      jobs.delete(id);
    }
  }
}

setInterval(sweepExpiredJobs, 15 * 60 * 1000).unref?.();

/**
 * Run async work over items with limited concurrency.
 */
async function mapPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;

  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  }

  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => run(),
  );
  await Promise.all(runners);
  return results;
}

/**
 * @param {object} params
 * @param {Function} params.processTrack - async (item, index, ctx) => { path, filename, ... }
 */
function createBatchJob({
  items,
  zipName,
  format,
  quality,
  userId,
  processTrack,
}) {
  ensureBatchDir();
  sweepExpiredJobs();

  const id = randomUUID();
  const folderName = String(zipName || "playlist")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, "")
    .slice(0, 80) || "playlist";

  const job = {
    id,
    status: "queued",
    total: items.length,
    succeeded: 0,
    failed: 0,
    currentTitle: null,
    zipName: folderName,
    format,
    quality,
    userId: userId || null,
    errors: [],
    error: null,
    createdAt: Date.now(),
    readyAt: null,
    cancelled: false,
    trackFiles: [],
    zipPath: null,
    processTrack,
    items,
  };

  jobs.set(id, job);

  // Kick off without blocking the HTTP response.
  setImmediate(() => {
    void runJob(job).catch((err) => {
      console.error(`batch job ${id} crashed:`, err);
      job.status = "error";
      job.error = err.message || "Batch job failed";
    });
  });

  return publicJob(job);
}

async function runJob(job) {
  job.status = "running";

  const outcomes = await mapPool(job.items, CONCURRENCY, async (item, index) => {
    if (job.cancelled) return null;

    const title =
      item.filename || item.title || `track-${index + 1}`;
    job.currentTitle = title;

    try {
      const result = await job.processTrack(item, index, job);
      if (!result?.path) {
        throw new Error("Missing output file");
      }
      job.trackFiles.push(result);
      job.succeeded += 1;
      return result;
    } catch (err) {
      job.failed += 1;
      job.errors.push({
        index: index + 1,
        title,
        error: err.message || String(err),
      });
      console.error(
        `batch job ${job.id} track ${index + 1} failed:`,
        err.message || err,
      );
      return null;
    }
  });

  if (job.cancelled) return;

  const ok = outcomes.filter(Boolean);
  job.currentTitle = null;

  if (ok.length === 0) {
    job.status = "error";
    job.error =
      job.errors[0]?.error ||
      "Every track failed to convert. Try fewer tracks or retry.";
    return;
  }

  // Single-file "zip" shortcut — still store a downloadable artifact.
  if (ok.length === 1) {
    const only = ok[0];
    job.zipPath = only.path;
    job.singleFile = true;
    job.singleFilename = only.filename;
    job.status = "ready";
    job.readyAt = Date.now();
    return;
  }

  const zipPath = path.join(BATCH_DIR, `${job.id}.zip`);
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 1 } }); // fast store-ish compression
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);
    for (const file of ok) {
      archive.file(file.path, {
        name: `${job.zipName}/${file.filename}`,
      });
    }
    archive.finalize();
  });

  // Free per-track files once zipped (zip is the artifact we keep).
  for (const file of ok) {
    fs.promises.unlink(file.path).catch(() => {});
  }
  job.trackFiles = [];
  job.zipPath = zipPath;
  job.singleFile = false;
  job.status = "ready";
  job.readyAt = Date.now();
}

module.exports = {
  createBatchJob,
  getJob,
  publicJob,
  deleteJob,
  BATCH_DIR,
  CONCURRENCY,
};
