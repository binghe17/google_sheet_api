//-----------구글시트 켠후> 도구>스크립트 편집기에 붙여넣기 >배포 (공유 링크 복사)

// Usage

//  1. Enter sheet name where data is to be written below

var SHEET_NAME = "Sheet1";


//  2. Run > setup
//
//  3. Publish > Deploy as web app 
//    - enter Project Version name and click 'Save New Version' 
//    - set security level and enable service (most likely execute as 'me' and access 'anyone, even anonymously) 
//
//  4. Copy the 'Current web app URL' and post this in your form/script action 
//
//  5. Insert column names on your destination sheet matching the parameter names of the data you are passing in (exactly matching case)


//----- 최초 한번 실행 (키생성)

var SCRIPT_PROP = PropertiesService.getScriptProperties(); // new property service

function setup() {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    console.log(doc.getId())
    SCRIPT_PROP.setProperty("key", doc.getId());
}


//----- If you don't want to expose either GET or POST methods you can comment out the appropriate function
function doGet(e){
  // console.log(e) //
  return handleResponse(e);
}

function doPost(e){
  return handleResponse(e);
}

    //
    function handleResponse(e) {
      // shortly after my original solution Google announced the LockService[1]
      // this prevents concurrent access overwritting data
      // [1] http://googleappsdeveloper.blogspot.co.uk/2011/10/concurrency-and-google-apps-script.html

      var lock = LockService.getPublicLock(); // we want a public lock, one that locks for all invocations
      lock.waitLock(30000);  // wait 30 seconds before conceding defeat.
      
      try {
        var action = e.parameter.action;
        if (action == 'insert') return insert(e);
        else if (action == 'retrieve') return retrieve(e);
        else if (action == 'update') return update(e);  
        else if (action == 'delete') return del(e);
      } 
      catch(e){
        // if error return this
        return ContentService
            .createTextOutput(JSON.stringify({"result":"error", "error": e}))
            .setMimeType(ContentService.MimeType.JSON);
      } 
      finally { //release lock
        lock.releaseLock();
      }
    }



//-----------

//추가 (행 데이터)
function insert(e) {
    // next set where we write the data - you could write to multiple/alternate destinations
    var doc = SpreadsheetApp.openById(SCRIPT_PROP.getProperty("key"));
    if(typeof e.parameter.sheetName != 'undefined') SHEET_NAME = e.parameter.sheetName
    var sheet = doc.getSheetByName(SHEET_NAME);
    
    // 헤더가 행 1에 있다고 가정하지만 GET / POST 데이터에서 header_row로 재정의 할 수 있습니다.
    var headRow = e.parameter.header_row || 1;
    console.log(headRow, '------')
    var numColumns = sheet.getLastColumn();
    var headers = sheet.getRange(headRow, 1, 1, numColumns).getValues()[0];
    var nextRow = sheet.getLastRow()+1; // get next row
    var row = getDataArr(headers, e);
    console.log(row)
    // 개별적으로보다 [][] 배열로 값을 설정하는 것이 더 효율적입니다.(아직 구현 안했음)
    sheet.getRange(nextRow, 1, 1, row.length).setValues([row]);
    return ContentService
        .createTextOutput(JSON.stringify({"result":true, "row": nextRow, "msg": "insert ok!"}))
        .setMimeType(ContentService.MimeType.JSON);
}

    //기능: (create_time열에 날짜 자동입력)
    function getDataArr(headers, e){
        var row = [];
        for (i in headers){ // loop through the header columns
          if (headers[i] == "create_time") row.push(today());
          else{
            if(typeof e.parameter[headers[i]] == 'undefined') row.push('');
            else row.push(e.parameter[headers[i]]);
          } 
        }
        return row;
    }


//수정 (행 데이터)
function update(e) {
  var doc = SpreadsheetApp.openById(SCRIPT_PROP.getProperty("key"));
  // console.log(typeof e.parameter.sheetName,'-------')
  if(typeof e.parameter.sheetName != 'undefined') SHEET_NAME = e.parameter.sheetName
  var sheet = doc.getSheetByName(SHEET_NAME);
  var numColumns = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, numColumns).getValues()[0];
  var row = getDataArr(headers, e);
  var rowId = e.parameter.rowId;
  var rs = '';
  if(rowId == '') rs = {"result":false, "msg": "not found rowId, update fail!"}
  else { 
    // 개별적으로보다 [][] 배열로 값을 설정하는 것이 더 효율적입니다.(아직 구현 안했음)
    sheet.getRange(rowId, 1, 1, numColumns).setValues([row]); //하나씩 수정
    rs = {"result":true, "row": rowId, "msg": "update ok!"};
  }
  return ContentService
      .createTextOutput(JSON.stringify(rs))
      .setMimeType(ContentService.MimeType.JSON);
}


//삭제
function del(e) {
  var doc = SpreadsheetApp.openById(SCRIPT_PROP.getProperty("key"));
  if(typeof e.parameter.sheetName != 'undefined') SHEET_NAME = e.parameter.sheetName
  var sheet = doc.getSheetByName(SHEET_NAME);
  var rowId = e.parameter.rowId || '';
  console.log(rowId, '----', typeof rowId)
  
  var rs = '';
  if(rowId == '') rs = {"result":false, "msg": "not found rowId, delete fail!"}
  else {
    sheet.deleteRow(rowId);
    rs = {"result":true, "row": rowId, "msg": "delete ok!"};
  }
  return ContentService
      .createTextOutput(JSON.stringify(rs))
      .setMimeType(ContentService.MimeType.JSON);
}


//조회 (구글 엑셀 내용 그대로)
function retrieve(e) {
  var doc = SpreadsheetApp.openById(SCRIPT_PROP.getProperty("key"));
  if(typeof e.parameter.sheetName != 'undefined') SHEET_NAME = e.parameter.sheetName
  var sheet = doc.getSheetByName(SHEET_NAME);
  var numRows = sheet.getLastRow();
  var numColumns = sheet.getLastColumn();
  var range =  sheet.getRange(1, 1, numRows, numColumns);
  
  var values = range.getValues();
  return ContentService
      .createTextOutput(JSON.stringify({"result":"success", "values": values}))
      .setMimeType(ContentService.MimeType.JSON);
}

//----------
    
  
    //날짜 ('Y-m-d H:i:s:x w t')
    function today(format, date){
        if(typeof format =='undefined') format='Y-m-d H:i:s';

        function pad(n, width) {
            if(typeof width == 'undefined') width = 2; 
            n = n + '';
            return n.length >= width ? n : new Array(width - n.length + 1).join('0') + n;
        }
        
        var today = (typeof date == 'undefined') ? new Date() : date;
    
        if(format.indexOf('Y') > - 1){
            var year = today.getFullYear(); // 년도
            format = format.replace(/Y/g, year)
        } 
        if(format.indexOf('m') > - 1){
            var month = pad(today.getMonth() + 1);  // 월
            format = format.replace(/m/g, month)
        } 
        if(format.indexOf('d') > - 1){
            var day = pad(today.getDate());  // 날짜
            format = format.replace(/d/g, day)
        } 
        if(format.indexOf('H') > - 1){
            var hours = pad(today.getHours()); // 시
            format = format.replace(/H/g, hours)
        }
        if(format.indexOf('i') > - 1){
            var minutes = pad(today.getMinutes());  // 분
            format = format.replace(/i/g, minutes)
        }
        if(format.indexOf('x') > - 1){
            var milliseconds = pad(today.getMilliseconds(), 3); // 밀리초
            format = format.replace(/x/g, milliseconds)
        }
        if(format.indexOf('s') > - 1){
            var seconds = pad(today.getSeconds());  // 초
            format = format.replace(/s/g, seconds)
        }
        if(format.indexOf('w') > - 1){
            var week = today.getDay();  // 요일
            format = format.replace(/w/g, week)
        }
        if(format.indexOf('n') > - 1){ //timestamp is number
            var timestamp = Date.parse(today);
            format = format.replace(/t/g, timestamp)
        }
        return format;
    }
    



