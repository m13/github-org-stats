# github-org-stats
Script to visualize github repository key information (->json->csv)


### (1) Configure `.env`:
```text
GITHUB_ORG_NAME=moneytree
GITHUB_AUTH_TOKEN=XXX
```

### (2) Add / Remove values from `repository.js`

### (3) Execute. Download into `output.json`
```bash
$ npm install
$ node repository.js
$ node team.js
```

Remember, Github allows 5000 requests by hour.

### (4) Convert JSON to CSV easily.
```bash 
$ npm install json2csv -g
$ json2csv -i output.json -o output.csv
```

### (5) Import output.csv into Google Sheets to analyze properly
