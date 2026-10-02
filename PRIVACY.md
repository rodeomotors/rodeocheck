# RodeoCheck V2 privacy notes

RodeoCheck V2 has no custom account system or custom backend in this build.

## Stored in this browser
RodeoCheck stores the following in `localStorage` on the device/browser where you use it:
- saved VIN reports and decoded vehicle fields
- auction/deal inputs such as MMR, bid, fees, transport, retail estimate and target gross
- inspection statuses/notes
- recon-planner items/costs
- title/NICB/manual history statuses
- auction announcements and vehicle notes
- saved contract-analysis text/results
- app settings

## Images
VIN and contract images selected for OCR are provided to the in-browser OCR process. RodeoCheck does not intentionally save those source image files into its own persistent local storage.

## Network requests
When the corresponding feature is used, the browser can contact:
- NHTSA/vPIC for public VIN/safety data
- jsDelivr/Tesseract resources for OCR code/language assets
- external source websites only after the user taps one of RodeoCheck's history/search links

If you deploy RodeoCheck on GitHub Pages, Cloudflare Pages, Netlify, Vercel or another host, the host can have its own normal server/CDN logs and privacy terms.

## Backups
The **Export full backup** function downloads the data currently stored by RodeoCheck as a JSON file. That file can contain VINs, vehicle notes and deal economics. Protect it like other dealership records and do not upload it to a public repository.

The **Restore backup** function reads a selected RodeoCheck JSON backup locally and replaces the current app data after confirmation.

## Deleting RodeoCheck data
Use **Settings → Erase local data** to delete RodeoCheck's local reports/settings. Clearing Safari/site data can also remove local RodeoCheck records. Export a backup first if you need to preserve them.
