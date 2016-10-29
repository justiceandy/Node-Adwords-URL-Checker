# Bulk Adwords URL Checker
Application takes excel file from Adwords console and checks all FinalURLs for active campaigns. URLs are checked by HEAD request to allow for checking thousands of urls at the same time.

## Notes:
If a url returns a 200 status code but no content, this script will not count it as invalid. HEAD requests dont return document content.

## Requirements
- Node
- Adwords UserID & Exported XLS File. [Sample included in Repo]

## Setup
- npm install

## Run Steps
- run command:
```
	node excel.js -u [AdwordsUserID] -d [domainToFilter] -o [OutputFolder] -r [RequestBreakCount]
```

## Command Line Arguments
- -u Google Adwords UserID [required]
- -d Domain Restrict Filter [optional]
- -o Output Folder [optional]
- -r Request Break Count [optional]

## Output
Application generates an XSLX & Json File for each batchID. Default output directory is generated folder
./generated/[batchID]/invalid.xlsx
./generated/[batchID]/invalid.json

## TODO
- Web View of JSON Files
- Add Additional Status codes option to FLAG
- Logstash Export Option for Cron Jobs
