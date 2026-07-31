"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { isAuthenticated } from "@/lib/auth";
import { fetchRatings, saveRating, type RatingMap } from "@/lib/ratings";

/**
 * The signed-in user's star ratings. Rating writes apply immediately and roll
 * back if the server rejects them, so clicking a star never feels laggy.
 */
export function useRatings() {
  const [ratings, setRatings] = useState<RatingMap>({});
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      if (!isAuthenticated()) {
        setSignedIn(false);
        setRatings({});
        return;
      }
      setSignedIn(true);
      fetchRatings()
        .then((data) => {
          if (!cancelled) setRatings(data);
        })
        .catch(() => {
          // A failed load only means the column starts empty; rating still works.
        });
    };

    load();
    window.addEventListener("auth-changed", load);
    return () => {
      cancelled = true;
      window.removeEventListener("auth-changed", load);
    };
  }, []);

  const rate = useCallback(async (subject: string, stars: number) => {
    let previous: number | undefined;
    setRatings((current) => {
      previous = current[subject];
      const next = { ...current };
      if (stars === 0) delete next[subject];
      else next[subject] = stars;
      return next;
    });

    try {
      await saveRating(subject, stars);
    } catch (err) {
      setRatings((current) => {
        const next = { ...current };
        if (previous === undefined) delete next[subject];
        else next[subject] = previous;
        return next;
      });
      toast.error(err instanceof Error ? err.message : "Failed to save rating");
    }
  }, []);

  return { ratings, rate, canRate: signedIn };
}
