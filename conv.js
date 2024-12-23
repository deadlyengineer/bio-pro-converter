const fs = require("fs");
const path = require("path");

const createCSV = (prefix) => {
  const date = new Date();
  const dateString = date.toISOString().split("T")[0]; // Get today's date in YYYY-MM-DD format
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");

  const time = `${hours}-${minutes}-${seconds}`;

  const fullPath = path.join(
    __dirname,
    "csv",
    dateString,
    `${prefix}_${dateString}_${time}.csv`
  );
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, ""); // Create an empty file

  console.log(`File created at: ${fullPath}`);
  return fullPath;
};

const writePath = createCSV("from");

let header = ''

const readJsonFiles = (folderPath) => {
  const files = fs.readdirSync(folderPath);

  const returnData = []

  files.forEach((file) => {
    const filePath = path.join(folderPath, file);
    if (path.extname(file) === ".json") {
      const fileContent = fs.readFileSync(filePath, {encoding: "utf8"});
      try {
        const jsonData = JSON.parse(fileContent);
        console.log(jsonData.results.length)
        returnData.push(...jsonData.results)
        header = jsonData.fieldMask
      } catch (err) {
        console.error("Error parsing JSON:", err);
      }
    }
  });
  return returnData
};

const fromData = readJsonFiles('./json/from')
const toData = readJsonFiles('./json/to')

console.log(fromData.length)
console.log(toData.length)

const recursiveFindValue = (header, item) => {
  if (header.length) {
    const value = item[header.shift()]
    if (value) {
      if (typeof value === 'object') {
        return recursiveFindValue(header, value)
      } else {
        return value
      }
    } else {
      return ''
    }
  } else {
    return ''
  }
}

const getExpandedRow = (fieldMask, item) => {
  const result = [];
  fieldMask.forEach(header => {
    const keys = header.split('.')
    result.push(recursiveFindValue(keys, item))
  })
  return result
}

const constants = {
  IMPRESSIONS_MIN_ABS_DIFFERENCE: 50,
  IMPRESSIONS_MIN_REL_DIFFERENCE: 0.25
}

let noMatch = [];

// for (let i = 0; i < fromData.length; i++) {
//     try {
//         const row = fromData[i];
//         const cor = toData.find(d => d.searchTermView?.resourceName === row.searchTermView?.resourceName)
//         if (!cor) noMatch.push(row)
//     } catch (e) {
//         console.error(e)
//     }
// }

noMatch = []

const headerRow = ['adGroup.resourceName', 'adGroup.name', 'searchTermView.resourceName', 'searchTermView.searchTerm', 'diff.abs', 'diff.rel', 'from.metrics.impressions', 'to.metrics.impressions']
fs.writeFileSync(writePath, [...headerRow, 'impressionPeriod1', 'impressionPeriod2'].join(',') + '\n', {flag: 'a'})

for (let i = 0; i < toData.length; i++) {
    try {
      console.log('checking todata: ', i)
        const compareFrom = toData[i];
        const { searchTermView: { resourceName } } = compareFrom;
        const compareTo = fromData.find(d => d.searchTermView?.resourceName === resourceName)
        if (!compareTo) noMatch.push(compareFrom)
        else {
            if (compareFrom.metrics.impressions) {
                const diffObj = JSON.parse(JSON.stringify(compareFrom))
                delete diffObj.metrics
                Object.assign(diffObj, { diff: { abs: 0, rel: 0 } })
                Object.assign(diffObj, { from: compareFrom })
                Object.assign(diffObj, { to: compareTo })
                if (true) {
                    if (
                        Math.abs(+compareFrom.metrics.impressions - +compareTo.metrics.impressions) > constants.IMPRESSIONS_MIN_ABS_DIFFERENCE
                        && Math.abs((+compareFrom.metrics.impressions - +compareTo.metrics.impressions) / +compareTo.metrics.impressions) > constants.IMPRESSIONS_MIN_REL_DIFFERENCE
                    ) {
                        diffObj.diff.abs = +compareFrom.metrics.impressions - +compareTo.metrics.impressions
                        diffObj.diff.rel = (((+compareFrom.metrics.impressions - +compareTo.metrics.impressions) / +compareTo.metrics.impressions) * 100).toFixed(0)
                        const row = getExpandedRow(headerRow, diffObj)
                        fs.writeFileSync(writePath, [...row, '2024-12-04...2024-12-10', '2024-11-27...2024-12-03'].join(',') + '\n', {flag: 'a'})
                    }
                } else {
                    diffObj.diff.push(compareFrom)
                    diffObj.diff.push(compareTo)
                }
            }
        }
    } catch (e) {
        console.error(e)
    }
}
