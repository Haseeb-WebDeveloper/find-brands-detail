# Image framing — Design

**Date:** 2026-10-23 · **Status:** approved by the owner the same day

## Purpose

The reviewer sees each campaign image and the cover **in the frame the site shows it in**, moves and
zooms it there (as db-admin's brand editor does), and that framing reaches the DB through the CSV.
Before this, db-admin's importer always cut the centre of every image.

## Decisions

| Topic | Decision |
|---|---|
| Frames | Campaign tile 200:236, cover card 16:11 (db-admin `FILL_FRAME_ASPECT`); the logo is shown in its circle, never cropped (the importer leaves logos whole) |
| Stored as | `{ zoom, x, y }`: zoom 1 = Fill Frame, x/y = the image point the frame is centred on; null = centre crop. On `campaign_images.framing` and `candidates.framing` (covers) |
| Crop math | `src/lib/images/framing.ts`, identical in db-admin, so the region shown here is the region cut there |
| CSV | `cover_image_framing`, `campaign_N_image_framing` = `"zoom,x,y"`; empty = centre crop (db-admin PR #176). Older db-admin ignores the columns |
| Editor | The full-screen viewer: drag, scroll/pinch, slider, Fill frame, Whole image; "Use this image" keeps the framing, "Save framing" for the one in use |

Reasoning lives in the docblocks of `framing.ts`, `frame-view.ts`, `image-viewer.tsx` and
`framed-image.tsx`.
