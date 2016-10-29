/*
  Script Reads Adwords Exported Excel File and Checks URLs found in FinalURL Field.
  Requests are made as HEAD since we dont need document contents.
  If the server returns a blank document and 200, this script will not flag the link.[V2 will catch this]
  It simply checks for status codes.

  Flagged Status Codes:
  301
  303
  404

  Command Line Arguments
  - d [domain]
  - o [Destination]
  - u [Adwords UserID] **

  Output Files for Excel and JSON.
*/

// required
var uuid = require('uuid');
var request = require('request');
var Promise = require('bluebird');
var XLSX = require('xlsx');
var json2xls = require('json2xls');
var prompt = require('prompt');
var fs = require('fs');

// Default Config Variable
//TODO: Change BatchID to UUID();
var config = {
  batchID: uuid.v1().slice(0, 12).replace('-',''),
  userID: '3643799307',
  version: '0.1',
  maxRequestCount: 500,
  file: 'test.xlsx',
  domains: {
    'filter': false
  },
  campaigns: {
    'filter': false
  },
  output: {
    'location': './generated'
  },
  aggregate: {
    'campaign': true
  },
  purge: true
};

// Loop Supplied Command Line Parameters
process.argv.forEach(function (val, index, array) {
  var original = val;
  var val = val.replace('-','');
  var commandSwitch = val.substring(0,2);
  var commandSwitchValue = val.substring(2, val.length);

  // If value contains an ='s character, it also contains a custom value so lets get that
  // If Domain is supplied
  if(commandSwitch === 'd='){
    // Set Domain Filter true, value as domains
    config.domains.filter = true;
    config.domains.value = commandSwitchValue;
  }
  // If Destination is Supplied
  if(commandSwitch === 'o='){
    config.output.location = commandSwitchValue;
    // UUID for FileName Output
    config.output.fileName = 'batch-';
  }
  // If User is Supplied
  if(commandSwitch === 'u='){
    config.userID = commandSwitchValue;
  }
});

// Delete Folder Contents
var deleteFolderRecursive = function(path) {
  if( fs.existsSync(path) ) {
    fs.readdirSync(path).forEach(function(file,index){
      var curPath = path + "/" + file;
      if(fs.lstatSync(curPath).isDirectory()) { // recurse
        deleteFolderRecursive(curPath);
      } else { // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
};

// If we are purging previous contents
if(config.purge){
  deleteFolderRecursive(config.output.location);
  fs.mkdirSync(config.output.location);
  fs.mkdirSync(config.output.location+'/'+config.batchID);
}

// Check that Folder Exists
if (!fs.existsSync(config.output.location+'/'+config.batchID)){
    fs.mkdirSync(config.output.location+'/'+config.batchID);
}



console.time('runTime');
// Read Command Line Values [UserID, ExcelFile, iteration count]

/* START Interal Functions */
// We are only reading first sheet since thats how adwords exports the xls file anyway. [single sheet]
exports.excelToArray = function(){
  return new Promise(function(resolve, reject) {
    // Read Excel File
    exports.readExcelFile(config.file)
    .then(function(result){
      // Create Cache Variables
      var bookCache = {};
      var campaignCache = {};
      // Loop Each Item in First Sheet [Nested Object]
      for(var prop in result.Sheets.Sheet1){
        // Letter is First Char in Prop
        var letter = prop.slice(0,1);
        var headerColumn = letter+''+1;
        // Replace Letter and we have row count
        var row = prop.replace(/[a-zA-Z]+/, '');
        // If we have Property and Header Values
        if(row > 1 && typeof(result.Sheets.Sheet1[prop]) != 'undefined' &&
          typeof(result.Sheets.Sheet1[headerColumn]) != 'undefined'){
          // Set Value
          var value = result.Sheets.Sheet1[prop]['v'];
          // Grab Property Name from Letter
          var propertyName = result.Sheets.Sheet1[headerColumn]['v'];
          // Now that we have value,row and property name... populate book cache
          if(typeof(bookCache[row]) === 'undefined'){
            bookCache[row]= {};
          }
          // if we dont have campaign in cache
          bookCache[row][propertyName.split(" ").join("")] = value;

          // If this Property is campaignID, and we are aggregating
          // lets add that to cache for group lookup
          if(propertyName === 'Campaign' && config.aggregate.campaign){
            if(typeof(campaignCache[value]) === 'undefined'){
              campaignCache[value] = {
                ads: [row],
                name: value
              }
            }
            // If cache variable exists, add to ads array
            else{
              campaignCache[value].ads.push(row)
            }
          }
        }
      }
      // Resolve
      resolve({campaigns: campaignCache, ads: bookCache});
    })
    .catch(function(err){
      reject(err);
    })
  });
}

// Json 2 XLS
exports.json2xls = function(array){
  return new Promise(function(resolve, reject) {
    var invalid = [];
    array.map(function(i){
      if(i.statusCode != 200 && typeof(i.url) != 'undefined'){
        console.log(i);
        invalid.push(i);
      }
    });
    console.log('Found:'+invalid.length+' invalid URLS');

    resolve(json2xls(invalid));
  });
}

// Write Results to XLS File
exports.writeXLSToDisk = function(xls){
  return new Promise(function(resolve, reject) {
    // Filename contains Batch Unique ID
    resolve(fs.writeFileSync(config.output.location+'/'+config.batchID+'/'+config.batchID+'.xlsx', xls, 'binary'))
  });
}

// Write Results to Json File
exports.writeJsonToDisk = function(arr){
  return new Promise(function(resolve, reject) {
    var jsonData = JSON.stringify(arr, null, 2);
    fs.writeFile(config.output.location+'/'+config.batchID+'/'+config.batchID+'.xlsx', jsonData, function(err) {
      res.json({ success: true });
    });
  });
}

// Create Excel File
exports.createExcelFile = function(urls){
  return new Promise(function(resolve, reject) {
    // Create XLS object from URL Array
    exports.json2xls(urls)
    // Once we have XLS Object, write it to disk
    .then(function(result){
      return exports.writeXLSToDisk(result);
    })
    // Once we have written to disk, resolve
    .then(function(result){
      resolve(true);
    })
    .catch(function(err){
      reject(err);
    })
  });
}

// Read Excel File [Returns Excel Object]
exports.readExcelFile = function(file){
  return new Promise(function(resolve, reject) {
    var workbook = XLSX.readFile(config.file);
    resolve(workbook);
  });
}

// Get Row Count of Excel File
exports.getRowCount = function(file){
  return new Promise(function(resolve, reject) {

  });
}

// Split XLS File into Smaller Files
exports.splitXLSFile = function(file){
  return new Promise(function(resolve, reject) {

  });
}

// Validate All Array of URLS
exports.validateURLS = function(urlArray){
  var urls = urlArray;
  return new Promise(function(resolve, reject) {

    // Array to Hold Invalid URLS
    var results = [];
    var promises = [];
    for(x=0;x<urlArray.length;x++){
      promises.push(exports.validateURL(urlArray[x].FinalURL, urlArray[x].AdgroupID, urlArray[x].AdID));
    }
    Promise.all(promises)
    .then(function(result){
        // If url isnt valid
        return result;
    })
    .then(function(result){
      resolve(result);
    })
    .catch(function(err){
      reject(err);
    })
  });
}

// Validate a single URL
exports.validateURL = function(url, campaignID, groupID){
  var urlProps = {
    'adgroupID': groupID,
    'adID': campaignID,
    'url': url
  };
  return new Promise(function(resolve, reject) {
    // If we dont have url, resolve. [Parent Campaigns dont include urls in export spreadsheet]
    if(typeof(urlProps.url) === 'undefined'){
      resolve(urlProps);
    }
    // Make HTTP Request for Headers [We dont need body content]
    request({'followRedirect': false, 'uri': urlProps.url, 'method': 'HEAD'})
    // When we get back response
    .on('response', function(response) {
      // Create Response Object
      var data = urlProps;

      data.link = 'https://adwords.google.com/cm/CampaignMgmt?authuser=2&__u='+config.userID+'&__c='+urlProps.adID+'#a.'+urlProps.adgroupID+'_1066840';
      data.statusCode = response.statusCode;
      if(data.statusCode != 200){
        console.log( urlProps.url, response.statusCode);
      }
      else{
        console.log(urlProps.url, response.statusCode);
      }
      // Resolve Response Object
      resolve(data);
    });
  });
}
/* End of Functions */


/* Script Start */
console.log('============================================');
console.log('Adwords Bulk URL Checker V'+config.version);
console.log('============================================');
console.log('Adwords Excel File:', config.file);
console.log('Batch ID:', config.batchID);
console.log('============================================');
console.log('Config Options:');
console.log('Domains:', 'ALL');
console.log('Purge Previous:', config.purge);
console.log('MaxRequestCount:', 500);
console.log('Output Location:', config.output.location+'/'+config.batchID);
console.log('============================================')

// Read Excel File
exports.readExcelFile(config.file)
// Determine if we need to Break Into Multiple Files
.then(function(result){
  var files = [];
  // Get Row Count

  // If Row > Max Request Count, split into multiple arrays
  return exports.excelToArray(result)
})
// Once we have Parsed URLs, Create Promise Array for Each Batch
.then(function(result){
  console.log(result);
  urls = [];
  for(prop in result.ads){
    urls.push(result.ads[prop]);
  }
  console.time('Crawl Time:');
  console.log('Validating URLS....');
  console.log(urls[0]);
  return exports.validateURLS([urls[0],urls[1]])
})
// Now that we have URLs and Status Codes in Array, Write them to Destination Folder
.then(function(result){
  console.log('============================================');
  console.timeEnd('Crawl Time:')
  console.log('============================================');
  console.timeEnd('runTime');
  //console.log(result);
  return exports.json2xls(result);
// INitialize HTTP Page to View Results if it doesnt exist
})
// Write XLS To Disk
.then(function(result){
  return exports.writeXLSToDisk(result);
  return true;
})
// Resolve Final Promise & Include Full Runtime
.catch(function(err){
  console.log('Error:', err);
})
