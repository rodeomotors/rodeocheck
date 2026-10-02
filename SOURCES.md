# RodeoCheck V2 source / API reference

RodeoCheck intentionally separates free/public data from proprietary or fee-funded vehicle-history sources.

## NHTSA / vPIC
- vPIC VIN API: https://vpic.nhtsa.dot.gov/api/
- NHTSA datasets and APIs: https://www.nhtsa.gov/nhtsa-datasets-and-apis
- NHTSA recalls: https://www.nhtsa.gov/recalls
- NHTSA API root: https://api.nhtsa.gov/

RodeoCheck uses vPIC for VIN decoding and NHTSA's year/make/model endpoints for recall campaigns and consumer complaints. Model-level recall/complaint results do not prove that the exact VIN had a condition. RodeoCheck links to the VIN-specific NHTSA recall page for exact-VIN verification.

## NICB
- VINCheck: https://www.nicb.org/vincheck
- Terms: https://www.nicb.org/vincheck/terms-use-vincheck

NICB VINCheck is a limited participating-insurer theft/salvage/flood screen and is not a comprehensive vehicle-history report. RodeoCheck links to NICB rather than automating or scraping it.

## NMVTIS / U.S. DOJ
- Consumer provider directory: https://vehiclehistory.bja.ojp.gov/nmvtis_vehiclehistory
- FAQ: https://vehiclehistory.bja.ojp.gov/faq/list

Consumer access is supplied through approved providers. Data can include state title information, odometer information, brands, theft and junk/salvage/total-loss information depending on the record/source.

## Texas
- TxDMV Title Check: https://www.txdmv.gov/motorists/buying-or-selling-a-vehicle/title-check-look-before-you-buy
- Texas OCCC motor-vehicle sales finance: https://occc.texas.gov/industry/motor-vehicle-sales-finance-mvsf/
- OCCC documentary-fee adoption: https://occc.texas.gov/sites/default/files/2024-06/mvsf-docfee-adoption-fc-071124.pdf

RodeoCheck's default Texas documentary-fee review threshold is $225. It is treated as a review benchmark / presumptively reasonable amount, not as a claim that every higher fee is automatically illegal.

## Auction-photo / listing research
RodeoCheck creates ordinary exact-VIN Google searches, including searches limited to domains such as bid.cars, copart.com and iaai.com. It does not scrape those sites, bypass logins, bypass robots restrictions, or represent results as authoritative vehicle-history data.

## Tesseract.js
- Project: https://tesseract.projectnaptha.com/
- CDN package used by the app: jsDelivr package for Tesseract.js 5

OCR is processed in the browser after the library/language assets load. OCR output is fallible and should be checked against the actual document.

## Dealer-entered values
MMR, auction price, retail estimate, auction fees, transport, recon and other costs are user-entered values. RodeoCheck performs arithmetic on these values but does not automatically retrieve Manheim MMR or represent its calculations as a market appraisal.
