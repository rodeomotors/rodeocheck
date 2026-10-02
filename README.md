# RodeoCheck V2

**RodeoCheck V2** is a private, no-subscription Progressive Web App (PWA) built for Rodeo Motors as an original dealer vehicle-intelligence workflow. It is not a copy of BeSure AI's code, branding, or proprietary data, and it is not affiliated with CARFAX, AutoCheck, BeSure AI, NHTSA, NICB, NMVTIS, Manheim, Copart, IAA, or any other vehicle-history provider.

The goal is to combine as much legitimately free/public vehicle information as possible with dealer-specific acquisition math, inspection notes, recon planning, contract OCR, and local report storage.

## What V2 adds

V2 turns the first version from a VIN checker into a dealer acquisition workspace.

### 1. VIN + public safety data
- 17-character VIN cleanup and North-American check-digit validation
- NHTSA vPIC VIN decoding
- Year, make, model, trim, body, drivetrain, engine, fuel, transmission, plant and vehicle-type fields when returned
- NHTSA year/make/model recall-campaign lookup
- NHTSA year/make/model consumer-complaint lookup
- One-tap link to NHTSA's VIN-specific recall page
- Existing saved report is refreshed instead of losing dealer-entered notes when the VIN is rechecked

### 2. Dealer acquisition economics
For each VIN, RodeoCheck can store:
- inventory stage: considering, bought/recon, ready for sale, sold
- stock number
- current odometer
- auction/seller
- lane/run number
- MMR or another wholesale benchmark
- estimated retail/list price
- target front-end gross
- purchase/bid price
- auction/buyer fees
- transport/tow cost
- recon budget
- other acquisition costs

It automatically calculates:
- **all-in acquisition cost**
- **projected front-end gross**
- **gross margin percentage**
- **maximum bid at your target gross**
- **spread to MMR**
- fixed costs beyond the vehicle bid
- whether the entered numbers meet the target gross you configured

The app deliberately labels that last item as deal arithmetic, not a universal “buy/don't buy” verdict. History and mechanical risks remain separate.

### 3. Itemized recon planner
Every vehicle includes a make-ready planner with default rows for:
- oil/filter
- state inspection
- tires
- brakes
- battery
- A/C and heat
- mechanical repair
- body/paint
- glass
- interior repair
- detail
- keys/remotes

You can add custom rows, mark them planned/done/not needed, and enter an estimated cost. If itemized recon costs are entered, their total becomes the recon amount used in the deal math; otherwise the manual recon-budget fallback is used.

### 4. Vehicle inspection checklist
Each report contains a status + note for:
- engine
- transmission
- cooling system
- A/C and heat
- warning lights
- OBD codes
- leaks
- brakes
- tires
- suspension/steering
- electrical
- body/frame
- glass
- interior
- test drive
- keys/remotes

Statuses are **Not checked, Pass, Attention, or Fail**. “Not checked” remains explicit so an uninspected system cannot accidentally look like a pass.

### 5. Manual history verification workspace
RodeoCheck keeps separate fields for:
- title/NMVTIS result
- title/history detail
- NICB VINCheck result
- whether prior auction photos/listings were found

It provides links for:
- NHTSA VIN-specific recalls
- NICB VINCheck
- Texas Title Check / NMVTIS guidance
- official DOJ NMVTIS provider directory
- exact-VIN Google web search
- exact-VIN image search
- exact-VIN searches limited to BIDCARS, Copart, and IAA domains

RodeoCheck does **not** scrape or bypass paid/limited services.

### 6. Auction notes
Dedicated fields are included for:
- auction announcements
- condition notes
- general report notes

### 7. Dealer report output
A completed vehicle report can be:
- saved locally
- shared as a compact text summary
- printed / saved as PDF through the browser
- exported as JSON

### 8. Inventory report screen
Saved vehicle reports can be searched by:
- VIN
- year/make/model/trim
- auction/seller
- lane/run
- stock number
- stage

The Reports screen also exports a dealer-oriented **CSV inventory file** with vehicle economics and inspection counts.

### 9. Dashboard economics
The Home screen shows:
- saved vehicle report count
- number of saved reports currently meeting the entered target gross
- saved contract analyses
- total planned acquisition cost
- projected retail
- projected gross
- average projected gross per vehicle

Only vehicles with relevant numbers entered contribute to the financial totals.

### 10. Contract / deal-sheet scanner
- select up to 12 document images
- OCR in the browser with Tesseract.js
- optional English + Spanish OCR language mode
- identifies common charges such as doc/admin fee, tax/title/registration, GAP, service contract, VIN etch, appearance protection, nitrogen, prep/recon, market adjustment, delivery and finance/acquisition fees
- extracts selling price, down payment, APR, term/number of payments, payment amount, amount financed, finance charge and total of payments when the OCR text is clear enough
- shows review amount, amount financed, estimated finance cost and payment × term math
- generates an English or Spanish review script
- saves contract analyses locally and supports JSON export

### 11. Backup and restore
Because this build has no account/server, V2 includes:
- **Export full backup** — creates one JSON file containing your reports, contract analyses and settings
- **Restore backup** — replaces the local RodeoCheck data with a selected backup
- automatic migration of data saved by the original V1 storage format when available

## Important limitation

A true CARFAX/AutoCheck-style nationwide history cannot be recreated using only free public data. Important datasets such as complete title chronology, insurer total-loss data, accident records, service records, ownership chronology and commercial auction archives can be proprietary, licensed, fee-funded, incomplete, or only available through approved providers.

RodeoCheck therefore distinguishes between:
1. **public facts it retrieves automatically**,
2. **manual history/condition findings you record**, and
3. **licensed or fee-based data that requires an outside provider**.

“No public record returned” is never presented as proof of a clean vehicle history.

---

# Put RodeoCheck V2 on your iPhone

RodeoCheck is a PWA. You do **not** need to publish it in the Apple App Store or pay Apple a developer fee for your own use.

## Recommended free method: GitHub Pages

### A. Put the files online
1. Download and unzip `RodeoCheck-V2-Final.zip`.
2. Create a free account at GitHub if you do not already have one.
3. Create a **new repository**. A name such as `rodeocheck` is fine.
4. Keep the repository **Public** if you plan to use free GitHub Pages on a normal personal account. Do not put private customer information directly in the source files; RodeoCheck report data is created later in your browser and is not part of the uploaded code.
5. Upload **the contents inside the `rodeocheck-pwa` folder** to the repository root. `index.html` should be visible at the top level of the repository.
6. Open the repository's **Settings**.
7. Select **Pages** in the left sidebar.
8. Under **Build and deployment**, choose **Deploy from a branch**.
9. Choose the `main` branch and `/ (root)` folder.
10. Click **Save**.
11. GitHub will generate an HTTPS Pages address, normally similar to `https://YOURNAME.github.io/rodeocheck/`.
12. RodeoCheck includes `noindex`/`robots.txt` hints to discourage search-engine indexing. These are privacy hints, not access control; anyone with the URL can still load the static app.

### B. Install it on the iPhone Home Screen
1. On the iPhone, open the GitHub Pages address in **Safari**.
2. Tap Safari's **Share** button — the square with the upward arrow.
3. Scroll down and choose **Add to Home Screen**.
4. Keep the name `RodeoCheck` or rename it if desired.
5. Tap **Add**.
6. A RodeoCheck icon will appear on the Home Screen.
7. Launch it from that icon. It opens in standalone app mode rather than looking like a normal Safari tab.

### Updating the app later
If the source files in GitHub are replaced with a future build, GitHub Pages will redeploy automatically. RodeoCheck's service worker is configured to prefer fresh app files while retaining an offline shell fallback.

If an old screen remains after a major update, close RodeoCheck completely and reopen it. If necessary, remove the Home Screen shortcut and add it again. **Export a RodeoCheck backup before intentionally clearing Safari website data.**

## Other free hosting choices
The folder is static and requires no build step. It can also be served by Cloudflare Pages, Netlify, Vercel static hosting, or another HTTPS web host.

## Local desktop test
From the `rodeocheck-pwa` folder:

```bash
python3 -m http.server 8080
```

Then visit:

```text
http://localhost:8080
```

The app shell can work offline after loading, but VIN lookup and OCR language resources require internet access.

## Data/privacy behavior
See `PRIVACY.md` for the full summary. In this V2 build:
- saved reports, contract text/results and settings are stored in browser localStorage
- selected VIN/contract images are used for OCR but are not intentionally persisted by RodeoCheck
- there is no custom RodeoCheck backend or account database
- external source sites open only when you tap their links
- NHTSA and the Tesseract CDN receive normal web requests when their functions are used

## Files
- `index.html` — app screens
- `styles.css` — mobile-first dealer UI
- `app.js` — VIN, calculations, inspection, recon, OCR, reports, backup/restore
- `manifest.webmanifest` — PWA install metadata
- `sw.js` — app-shell service worker/cache
- `icons/` — Home Screen icons
- `SOURCES.md` — data/API source notes
- `PRIVACY.md` — local-storage/network behavior
- `CHANGELOG.md` — V2 feature summary

## Version
**RodeoCheck 2.0.0 — finalized V2 build**
