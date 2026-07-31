"use client";

import { useMemo } from "react";
import { ItemDetailsModal } from "@/components/desk/item-details-modal";
import { useDeskActions } from "@/components/desk/use-desk-actions";
import { useRatings } from "@/components/desk/use-ratings";
import { deskItemFromPlayableTrack, type DeskItem } from "@/lib/desk";
import { usePlayer, type PlayableTrack } from "@/lib/player";

/**
 * The desk's details sheet for whatever the player bar is playing. Mounted only
 * while open so the bar does not pay for the ratings fetch on every page.
 */
export function NowPlayingDetails({
  track,
  onClose,
}: {
  track: PlayableTrack;
  onClose: () => void;
}) {
  const { queue } = usePlayer();
  const actions = useDeskActions();
  const { ratings, rate, canRate } = useRatings();

  const item = useMemo(() => {
    const base = track.item ?? deskItemFromPlayableTrack(track);
    const quality = base.ratingKey ? (ratings[base.ratingKey] ?? null) : null;
    return quality === base.quality ? base : { ...base, quality };
  }, [track, ratings]);

  // Listening from here should restart within the queue rather than shrink it
  // down to this one track.
  const listenContext = useMemo(() => {
    const rows = queue
      .map((entry) => entry.item)
      .filter((entry): entry is DeskItem => Boolean(entry));
    return rows.some((row) => row.key === item.key) ? rows : [item];
  }, [queue, item]);

  const ratingKey = item.ratingKey;

  return (
    <ItemDetailsModal
      item={item}
      busy={actions.busy}
      onClose={onClose}
      onDownload={() => void actions.download(item)}
      onListen={() => void actions.listen(item, listenContext)}
      onWatch={() => actions.watch(item)}
      onOpenList={() => void actions.openPlaylist(item)}
      onRate={
        canRate && ratingKey
          ? (stars) => void rate(ratingKey, stars)
          : undefined
      }
    />
  );
}
