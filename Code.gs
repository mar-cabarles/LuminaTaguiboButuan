/*******************************************************
 * COMMUNITY MARKET HUB
 * GOOGLE APPS SCRIPT - GENERAL BACKEND
 *******************************************************/

/* =====================================================
   1. CONFIGURATION
===================================================== */
const CONFIG = {
  SPREADSHEET_ID: '1HBGhTZow0X9EjhUeQi4Ay6Iv_91L_DjQ6ihvgsPkeM4',
  SHEETS: {
    WATER: 'Water Data',
    CONSUMER: 'Consumer Data',
    CONSUMER_ITEMS: 'Consumable Items',
    INQUIRY: 'Inquiry',
    RIDES: 'Rides',
    SORTING_ADDRESS: 'sorting address'
  },
  PAGES: {
    INDEX: 'index',
    WATER_FORM: 'waterForm',
    CONSUMER_FORM: 'consumerForm',
    WATER_TABLE: 'waterTable',
    CONSUMER_TABLE: 'consumerTable',
    INQUIRY: 'Inquiry',
    RIDES: 'Rides',
    RIDES_TABLE: 'RidesTable',
    ADS: 'Ads'
  },
  TELEGRAM: {
    WATER_BOT_TOKEN: '8692330388:AAH4wncqQ0ursWAyPVQGDBPpju_GzTtkDBQ',
    CONSUMER_BOT_TOKEN: '8882179087:AAFGjVo7XPlshbcdfVN7_-2zVq_IjrRNEyA',
    RIDES_BOT_TOKEN: '8971953563:AAFTW_PgHScRmFXavydq-EP0B_F0AkAAWyY', // Added Rides Token
    CHAT_ID: '8992653248' // Trimmed the trailing space for safety
  }
};

/* =====================================================
   2. WEB APP ROUTING (GET & POST)
===================================================== */
function doGet(e) {
  const requestedPageParam = e?.parameter?.page?.trim().toLowerCase() || CONFIG.PAGES.INDEX.toLowerCase();
  
  const pageKey = Object.keys(CONFIG.PAGES).find(key => CONFIG.PAGES[key].toLowerCase() === requestedPageParam);
  const page = pageKey ? CONFIG.PAGES[pageKey] : CONFIG.PAGES.INDEX;
  
  const template = HtmlService.createTemplateFromFile(page);
  template.APP_URL = ScriptApp.getService().getUrl().trim();

  return template.evaluate()
    .setTitle('Community Market Hub')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
}

    // ==========================================
    // COMBINED DOPOST
    // ==========================================
    
function doPost(e) {
  try {
    if (!e || !e.parameter) throw new Error("No form parameters received.");
    const params = e.parameter;
    
    // ==========================================
    // 1. RIDES FORM HANDLING
    // ==========================================
    // If the form has a "Destination" field, it's a Ride Request
    if (params.Destination || params.Phase) {
      const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(CONFIG.SHEETS.RIDES);
      
      const date = params['Date'] || new Date().toLocaleString();
      const status = params['Status'] || 'Pending';
      const driver = params['Driver'] || '+driver';
      const contact = params['Contact / Messenger'] || '';
      const phase = params['Phase'] || '';
      const block = params['Block'] || '';
      const lot = params['Lot'] || '';
      const destination = params['Destination'] || '';
      const passengers = params['# of Passenger'] || '';
      const pickupTime = params['Pickup Time'] || '';
      const cargoNotes = params['Cargo Notes'] || '';

      sheet.appendRow([date, status, driver, contact, phase, block, lot, destination, passengers, pickupTime, cargoNotes]);
      SpreadsheetApp.flush();

      // Adjust the success function here if you have a custom one, otherwise use basic JSON
      return ContentService.createTextOutput(JSON.stringify({ result: "success", message: "Ride requested successfully." }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // ==========================================
    // 2. INQUIRY FORM HANDLING
    // ==========================================
    // Otherwise, assume it's the Inquiry form
    else {
      // Assuming getSheet() is a custom helper function you have defined elsewhere
      const sheet = getSheet(CONFIG.SHEETS.INQUIRY); 
      
      const name = String(params.Name || params.name || "").trim();
      const email = String(params.Email || params.email || "").trim();
      const type = String(params["Inquiry Type"] || params.inquiryType || "").trim();
      const message = String(params.Message || params.message || "").trim();

      if (!name && !email && !type && !message) {
        throw new Error("No recognized form fields were received.");
      }

      sheet.appendRow([new Date(), name, email, type, message]);
      SpreadsheetApp.flush();

      // Assuming success() is a custom helper function you have defined elsewhere
      return ContentService.createTextOutput(JSON.stringify(success(null, "Inquiry submitted successfully.")))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
  } catch (error) {
    // Assuming failure() is a custom helper function you have defined elsewhere
    return ContentService.createTextOutput(JSON.stringify(failure(error)))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/* =====================================================
   3. GLOBAL HELPERS & UTILITIES
===================================================== */
function getSpreadsheet() {
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function getSheet(sheetName) {
    const sheet = getSpreadsheet().getSheetByName(sheetName);

    if (!sheet) {
        throw new Error(`Sheet not found: "${sheetName}"`);
    }

    return sheet;
}

function success(data, message = '') {
    return {
        success: true,
        message: message,
        data: data || null
    };
}

function failure(error) {
    console.error(error);

    return {
        success: false,
        message: error?.message || String(error),
        data: null
    };
}

function formatDateToString(val, timeZone = Session.getScriptTimeZone()) {
  if (!val) return "";
  const dateObj = (val instanceof Date) ? val : new Date(val);
  if (!isNaN(dateObj.getTime())) return Utilities.formatDate(dateObj, timeZone, "yyyy-MM-dd");
  return String(val).trim().substring(0, 10);
}

function normalizeAddress(address) {
  const text = String(address || '').trim();
  const normalizedMatch = text.match(/^\s*(\d+)\s*[.-]\s*(\d+)\s*[.-]\s*(\d+)\s*$/);
  if (normalizedMatch) return `${normalizedMatch[1]}.${normalizedMatch[2]}.${normalizedMatch[3]}`;

  const phaseMatch = text.match(/\bph(?:ase)?\.?\s*(\d+)/i);
  const blockMatch = text.match(/\b(?:blk|block)\.?\s*(\d+)/i);
  const lotMatch = text.match(/\blot\.?\s*(\d+)/i);

  if (!phaseMatch || !blockMatch || !lotMatch) return '';
  return `${phaseMatch[1]}.${blockMatch[1]}.${lotMatch[1]}`;
}

function findAddressUniqueId(normalizedAddress) {
  const targetAddress = normalizeAddress(normalizedAddress);
  if (!targetAddress) return '';

  const sortingSheet = getSheet(CONFIG.SHEETS.SORTING_ADDRESS);
  if (sortingSheet.getLastRow() < 2) return '';

  const rows = sortingSheet.getRange(2, 1, sortingSheet.getLastRow() - 1, 6).getDisplayValues();
  for (let row of rows) {
    if (normalizeAddress(row[5]) === targetAddress && row[0] !== '') return row[0]; // Returns Unique ID
  }
  return '';
}

function sendTelegramMessage(botToken, chatId, text, useMarkdown = false) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const payload = { chat_id: chatId, text: text };
  if (useMarkdown) payload.parse_mode = 'Markdown';
  
  UrlFetchApp.fetch(url, { method: 'post', payload: payload, muteHttpExceptions: true });
}

/* =====================================================
   4. WATER HUB OPERATIONS
===================================================== */
function getWaterData() {
  const sheet = getSheet(CONFIG.SHEETS.WATER);
  const rawData = sheet.getDataRange().getValues();
  const displayData = sheet.getDataRange().getDisplayValues();
  if (rawData.length <= 1) return [];

  return displayData.slice(1).map((displayRow, index) => {
    let safeTimestamp = rawData[index + 1][0]; 
    if (safeTimestamp instanceof Date) safeTimestamp = safeTimestamp.toISOString();

    return {
      rowId: index + 2, timestamp: safeTimestamp, customer: displayRow[1], address: displayRow[2],
      refill: displayRow[3], bottle: displayRow[4], amount: displayRow[5], paymentType: displayRow[6],
      paymentGiven: displayRow[7], change: displayRow[8], gcashRef: displayRow[9], instructions: displayRow[10],
      bottleCondition: displayRow[11], status: displayRow[12], uniqueId: displayRow[14]
    };
  });
}

function filterWaterData(filterDate, filterAddress) {
  const sheet = getSheet(CONFIG.SHEETS.WATER);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return data;

  const timeZone = sheet.getParent().getSpreadsheetTimeZone();
  const targetDateStr = filterDate ? formatDateToString(filterDate, timeZone) : formatDateToString(new Date(), timeZone);
  const search = String(filterAddress || '').trim().toLowerCase();

  let results = data.slice(1).filter(row => {
    const isDateMatch = formatDateToString(row[0], timeZone) === targetDateStr;
    const isAddressMatch = !search || String(row[2] || '').trim().toLowerCase().includes(search);
    return isDateMatch && isAddressMatch;
  });

  results.sort((a, b) => {
    const numA = Number(a[14]);
    const numB = Number(b[14]);
    const validA = a[14] !== "" && !isNaN(numA);
    const validB = b[14] !== "" && !isNaN(numB);
    
    if (validA && validB) return numA - numB;
    if (validA) return -1;
    if (validB) return 1;
    return String(a[14] || "").localeCompare(String(b[14] || ""));
  });

  return [data[0], ...results];
}

function getTodaySortedDeliveries() {
  return filterWaterData(new Date(), null); // Reuses the optimized filter function
}

function saveWaterOrder(orderData) {
  try {
    if (!orderData) throw new Error('No order data received.');
    const sheet = getSheet(CONFIG.SHEETS.WATER);
    const normalizedAddress = normalizeAddress(orderData.address);
    const uniqueId = findAddressUniqueId(normalizedAddress);

    const row = [
      new Date(), orderData.contactInfo || '', orderData.address || '', Number(orderData.refillQty) || 0,
      Number(orderData.bottleQty) || 0, Number(orderData.amountDue) || 0, orderData.paymentType || '',
      Number(orderData.amountGiven) || 0, Number(orderData.change) || 0, orderData.gcashReference || '',
      orderData.deliveryInstructions || '', orderData.bottleCondition || '', orderData.status || 'for collection',
      normalizedAddress, uniqueId
    ];

    sheet.appendRow(row);
    SpreadsheetApp.flush();

    const msg = `🚨 NEW WATER ORDER\n\nName: ${orderData.contactInfo || 'Not provided'}\nAddress: ${orderData.address || 'Not provided'}\nRefill: ${Number(orderData.refillQty) || 0} | Bottle: ${Number(orderData.bottleQty) || 0}\nInstructions: ${orderData.deliveryInstructions || 'None'}`;
    sendTelegramMessage(CONFIG.TELEGRAM.WATER_BOT_TOKEN, CONFIG.TELEGRAM.CHAT_ID, msg);

    return success({ rowId: sheet.getLastRow(), normalizedAddress, uniqueId }, 'Water order saved.');
  } catch (error) {
    return failure(error);
  }
}

function updateWaterStatus(rowId, newStatus) {
  const allowedStatuses = ['for collection', 'for delivery - pending', 'for delivery - paid', 'delivered - pending', 'delivered - paid', 'cancelled'];
  const status = String(newStatus || '').trim().toLowerCase();
  const sheetRow = Number(rowId);

  if (!Number.isInteger(sheetRow) || sheetRow < 2) throw new Error('Invalid row number.');
  if (!allowedStatuses.includes(status)) throw new Error(`Invalid status: ${status}`);

  const sheet = getSheet(CONFIG.SHEETS.WATER);
  if (sheetRow > sheet.getLastRow()) throw new Error('Order no longer exists.');

  sheet.getRange(sheetRow, 13).setValue(status); // Column M (13)
  return success({ rowId: sheetRow, status });
}


/* =====================================================
   5. CONSUMER HUB OPERATIONS
   Load products from the "Consumable Items" sheet
===================================================== */
function getConsumableItems() {
  // Ensure getSheet and CONFIG are defined in your backend
  const sheet = getSheet(CONFIG.SHEETS.CONSUMER_ITEMS);
  const data = sheet.getDataRange().getValues();

  if (data.length < 2) return [];

  const headers = data[0].map(h => String(h).trim().toLowerCase());

  const itemIndex = headers.indexOf('item');
  const sizeIndex = headers.indexOf('size');
  const amountIndex = headers.indexOf('amount');

  if (itemIndex === -1 || sizeIndex === -1 || amountIndex === -1) {
    throw new Error(
      'Consumable Items sheet must contain "Item", "size", and "amount" columns.'
    );
  }

  return data.slice(1)
    .filter(row => String(row[itemIndex] || '').trim() !== '')
    .map(row => ({
      item: String(row[itemIndex]).trim(),
      size: String(row[sizeIndex] || '').trim(),
      amount: Number(String(row[amountIndex] ?? '').replace(/[₱,\s]/g, '')) || 0
    }));
}

function saveConsumerOrder(orderData) {
  try {
    if (!orderData) throw new Error('No order data received.');
    const sheet = getSheet(CONFIG.SHEETS.CONSUMER);
    
    let totalQty = 0, totalAmount = 0, itemNameList = [], itemsDescription = '';
    const items = orderData.items || [];
    
    items.forEach(item => {
      // FIXED: Added '*' operator for multiplication
      const qty = Number(item.qty) || 0;
      const subtotal = Number(item.subtotal) || (qty * (Number(item.price) || 0));
      const name = item.item || item.name || 'Item';
      
      totalQty += qty;
      totalAmount += subtotal;
      itemNameList.push(`${name} (${qty})`);
      
      // FIXED: Cleaned up the string interpolation to stay on one line
      itemsDescription += `• ${name} (${item.variant || 'Standard'}) x ${qty} - ₱${subtotal.toFixed(2)}\n`;
    });

    const paymentGiven = Number(orderData.paymentGiven || orderData.cashOnHand || 0);
    let change = Number(orderData.change) || 0;
    
    // FIXED: Added '-' operator for subtraction
    if (change === 0 && paymentGiven > totalAmount) {
      change = paymentGiven - totalAmount;
    }

    const row = [
      new Date(), orderData.contactInfo || '', orderData.address || '', totalQty, itemNameList.join(', '), 
      totalAmount, orderData.paymentType || 'Cash', paymentGiven, change, orderData.gcashReference || '', 
      orderData.deliveryTime ? "'" + String(orderData.deliveryTime).trim() : 'Anytime / Regular dispatch', 
      orderData.status || 'pending'
    ];

    sheet.appendRow(row);
    SpreadsheetApp.flush();

    const msg = `💧 *ORDER RECEIVED - LUMINA CONSUMER*\n\nThank you, ${orderData.contactInfo || 'Customer'}!\n\n📍 *Address:* ${orderData.address || 'N/A'}\n⏱️ *Delivery:* ${orderData.deliveryTime || 'ASAP'}\n\n📦 *Items:*\n${itemsDescription || 'None'}\n💰 *Total:* ₱${totalAmount.toFixed(2)}`;
    sendTelegramMessage(CONFIG.TELEGRAM.CONSUMER_BOT_TOKEN, CONFIG.TELEGRAM.CHAT_ID, msg, true);

    // FIXED: Included orderId in the data payload so the frontend can display it in the success modal
    const generatedOrderId = 'CNS-' + sheet.getLastRow();
    return success({ rowId: sheet.getLastRow(), orderId: generatedOrderId }, 'Consumer order saved.');
    
  } catch (error) {
    return failure(error);
  }
}

function updateConsumerStatus(rowId, newStatus) {
  const sheet = getSheet(CONFIG.SHEETS.CONSUMER);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim().toLowerCase());
  const statusCol = headers.indexOf('status');
  
  if (statusCol === -1) throw new Error('Column "Status" not found.');
  if (!Number(rowId) || Number(rowId) < 2) throw new Error('Invalid row: ' + rowId);

  sheet.getRange(Number(rowId), statusCol + 1).setValue(newStatus);
  return success({ rowId, status: newStatus });
}

/* =====================================================
   LOAD CONSUMER DATA FOR DASHBOARD TABLE
===================================================== */


function getConsumerData() {
  try {
    const sheet = getSheet(CONFIG.SHEETS.CONSUMER);

    if (!sheet) {
      throw new Error('Consumer Data sheet not found.');
    }

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow < 1 || lastCol < 1) {
      return { headers: [], rows: [] };
    }

    const data = sheet
      .getRange(1, 1, lastRow, lastCol)
      .getValues();

    const headers = data[0].map(h => String(h).trim());

    if (lastRow < 2) {
      return { headers: headers, rows: [] };
    }

    const rows = data.slice(1).map((row, index) => {
      const record = {
        rowId: index + 2
      };

      headers.forEach((header, col) => {
        const key = header.toLowerCase();

        let value = row[col];

        if (value instanceof Date) {
          value = Utilities.formatDate(
            value,
            Session.getScriptTimeZone(),
            'yyyy-MM-dd HH:mm:ss'
          );
        }

        // Preserve original sheet-header names.
        if (header) record[header] = value;

        // Also provide normalized header names.
        if (key) record[key] = value;
      });

      // Explicit aliases used by the dashboard HTML.
      record.timestamp = record['time stamp'] || '';
      record.contactInfo = record['contact info'] || '';
      record.address = record['address'] || '';
      record.itemQty = record['item qty'] ?? '';
      record.item = record['item'] || '';
      record.amountDue = record['amount due'] ?? '';
      record.paymentType = record['payment type'] || '';
      record.paymentGiven = record['payment given'] ?? '';
      record.change = record['change'] ?? '';
      record.gcashReference = record['gcash ref.#'] || '';
      record.deliveryTime = record['delivery time'] || '';
      record.status = record['status'] || '';

      return record;
    });

    return {
      headers: headers,
      rows: rows
    };

  } catch (error) {
    console.error('getConsumerData failed:', error);
    throw new Error('Unable to load consumer data: ' + error.message);
  }
}



const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1HBGhTZow0X9EjhUeQi4Ay6Iv_91L_DjQ6ihvgsPkeM4/edit';
const SHEET_NAME = 'Rides';

// ---------------------------------------------------------
// 6. RIDES SAVE TO GOOGLE SHEET
// METHOD 1: Handles the fetch() POST request from your form
// ---------------------------------------------------------
/* =====================================================
   RIDES MODULE - BACKEND FUNCTION
===================================================== */
function saveRideOrder(rideData) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.RIDES);
    
    const date = new Date().toLocaleString();
    const status = "Pending";
    const driver = "'+driver"; // Text prefix to avoid #NAME? formula error
    
    // Automatically calculate fare 
    const passengers = Math.max(1, parseInt(rideData.passengers, 10) || 1);
    const calculatedFare = passengers * 1.666666666666667;

    sheet.appendRow([
      date,                                    // Col A: Date
      rideData.contact || '',                  // Col B: Contact / Messenger
      rideData.phase || '',                    // Col C: Phase
      rideData.block || '',                    // Col D: Block
      rideData.lot || '',                      // Col E: Lot
      rideData.destination || '',              // Col F: Destination
      passengers,                              // Col G: # of Passenger
      calculatedFare,                          // Col H: Amount / passenger (₱5, ₱10, ₱15, etc.)
      rideData.pickupTime || 'waiting already',// Col I: Pickup Time
      rideData.cargoNotes || '',               // Col J: Cargo Notes
      driver,                                  // Col K: Driver
      status                                   // Col L: Status
    ]);

    SpreadsheetApp.flush();

// Format the address cleanly
    const pickupAddress = `Phase ${rideData.phase || '-'}, Block ${rideData.block || '-'}, Lot ${rideData.lot || '-'}`;

    // Construct the Telegram message
    const rideMsg = `🚖 NEW RIDE REQUEST\n\n` +
                    `Contact: ${rideData.contact || 'Not provided'}\n` +
                    `Pickup: ${pickupAddress}\n` +
                    `Destination: ${rideData.destination || 'Not provided'}\n` +
                    `Passengers: ${passengers}\n` +
                    `Est. Dispatch: ₱${calculatedFare} / pax\n` +
                    `Time: ${rideData.pickupTime || 'waiting already'}\n` +
                    `Cargo/Notes: ${rideData.cargoNotes || 'None'}`;
                    
    // Send the notification using the Rides bot token
    sendTelegramMessage(CONFIG.TELEGRAM.RIDES_BOT_TOKEN, CONFIG.TELEGRAM.CHAT_ID, rideMsg);

    return { 
      success: true, 
      orderRef: "RIDE-" + Math.floor(1000 + Math.random() * 9000),
      fare: calculatedFare
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/* =====================================================
   HELPER FUNCTIONS (Add if not already in Code.gs)
===================================================== */
function getSheet(sheetName) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}

function success(data, message = "Success") {
  return { status: "success", message: message, data: data };
}

function failure(error) {
  return { status: "error", message: error.message || String(error) };
}

/* =====================================================
   RIDES TABLE FETCH DATA
===================================================== */

// Fetches all ride data for the Dispatch Dashboard
function getDispatchData() {
  const sheet = getSheet(CONFIG.SHEETS.RIDES); 
  const data = sheet.getDataRange().getValues();
  
  // Remove the header row
  data.shift(); 
  
  // Map the rows into clean objects matching your column structure
  return data.map(row => ({
    date: row[0],
    contact: row[1],
    phase: row[2],
    block: row[3],
    lot: row[4],
    destination: row[5],
    passengers: row[6],
    fare: row[7],
    pickupTime: row[8],
    cargoNotes: row[9],
    driver: row[10], // Column K
    status: row[11]  // Column L
  }));
}

function getActiveRides() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Rides");
  
  if (!sheet) {
    throw new Error("Sheet tab 'Rides' was not found in this spreadsheet.");
  }
  
  // getDisplayValues() gets the date as a string exactly how it looks in Sheets
  const data = sheet.getDataRange().getDisplayValues();
  if (data.length <= 1) return []; 
  
  data.shift(); // Remove the header row
  
  const rides = data.map((row, index) => {
    const paxCount = parseFloat(row[6]) || 1;
    const farePerPax = parseFloat(row[7]) || 0;
    
    // FIXED: Added the '*' to multiply pax by fare
    const calculatedTotalFare = (farePerPax).toFixed(2);
    
    let locationStr = "N/A";
    if (row[2] || row[3] || row[4]) {
      locationStr = `Ph ${row[2] || '-'}, Blk ${row[3] || '-'}, Lot ${row[4] || '-'}`;
    }

    return {
      rowId:       index + 2,                  // Exact row number in Google Sheets
      date:        row[0] || "",               // FIXED: ADDED THE DATE HERE!
      passenger:   row[1] || "N/A",            // Contact / Messenger
      location:    locationStr,                
      destination: row[5] || "",               
      pax:         row[6] || "1",              
      pickup:      row[8] || "N/A",            
      fare:        calculatedTotalFare,        
      driver:      row[10] || "",              // Driver
      status:      row[11] || "Pending"        // Status
    };
  });
  
  return rides;
}

// NEW: Function to save the dropdown changes to the exact row
function updateRideDetails(rowId, driverName, status) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Rides");
  
  // Column 11 is 'Driver' (K), Column 12 is 'Status' (L)
  sheet.getRange(rowId, 11).setValue(driverName);
  sheet.getRange(rowId, 12).setValue(status);
}

// Fetches the list of drivers from the "Drivers" sheet
function getDriversList() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Drivers");
  if (!sheet) return []; 
  
  const lastRow = sheet.getLastRow();
  // Safety check: Prevents crashing if the sheet is empty or only has a header!
  if (lastRow < 2) return []; 
  
  const data = sheet.getRange("A2:A" + lastRow).getValues();
  return data.map(row => row[0]).filter(name => name !== "");
}


