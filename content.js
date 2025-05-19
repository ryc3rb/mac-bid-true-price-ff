// --- Configuration Variables (Loaded from storage, with defaults) ---
let currentBuyersPremiumRate = 15.0; // Default 15%
let currentLotFee = 3.00;           // Default $3.00
let currentSalesTaxRate = 7.0;      // Default 7%
let showPriceOverlay = true;        // Default to show the on-page overlay

const TRUE_PRICE_ELEMENT_ID = 'macbid-true-price-extension-display';
const CLOSE_BUTTON_ID = 'macbid-price-overlay-close-btn-id'; // Unique ID for the close button

let lastKnownBid = null; // For comparing if bid changed to optimize DOM updates
let debounceTimer = null; // For debouncing MutationObserver callbacks

// --- Helper Function: Clean Price String ---
function cleanPriceString(priceString) {
  if (!priceString) return null;
  // Removes currency symbols ($, etc.), commas, and any non-numeric characters except the decimal point.
  return parseFloat(priceString.replace(/[^\d.-]/g, '').trim());
}

// --- Function to Get Calculated Price Details (Primarily for Popup) ---
function getCalculatedPriceDetails() {
  const currentBidElement = document.querySelector('div.h1.font-weight-normal.text-accent.mb-0 div.d-flex span:last-of-type');
  if (!currentBidElement) {
    // console.log("ContentJS (getCalculatedPriceDetails): Bid element not found.");
    return null;
  }

  const currentBidText = currentBidElement.textContent;
  const winningBid = cleanPriceString(currentBidText);
  if (isNaN(winningBid)) {
    // console.log("ContentJS (getCalculatedPriceDetails): Could not parse winning bid from text:", currentBidText);
    return null;
  }

  const buyersPremiumAmount = winningBid * (currentBuyersPremiumRate / 100);
  const lotFee = currentLotFee;
  const subtotalBeforeTax = winningBid + buyersPremiumAmount + lotFee;
  const salesTaxDecimal = currentSalesTaxRate / 100;
  const salesTaxAmount = subtotalBeforeTax * salesTaxDecimal;
  const truePrice = subtotalBeforeTax + salesTaxAmount;

  return {
    winningBid,
    buyersPremiumAmount,
    lotFee,
    buyersPremiumRateApplied: currentBuyersPremiumRate,
    salesTaxRateApplied: currentSalesTaxRate,
    subtotalBeforeTax,
    salesTaxAmount,
    truePrice
  };
}

// --- Core Logic: Calculate and Display True Price on Page Overlay ---
function calculateAndDisplayTruePrice() {
  if (!showPriceOverlay) {
    removeTruePriceDisplay(); // If overlay is toggled off, ensure it's removed
    return;
  }

  const priceDetails = getCalculatedPriceDetails(); // Use the common calculation logic

  if (!priceDetails) {
    // console.log("ContentJS (calculateAndDisplayTruePrice): Could not get price details. Removing display.");
    removeTruePriceDisplay();
    return;
  }

  // Optimization: Only update DOM if the bid has actually changed
  if (lastKnownBid !== null && priceDetails.winningBid === lastKnownBid) {
    // console.log("ContentJS: Bid has not changed ($" + priceDetails.winningBid + "). Skipping DOM update for on-page overlay.");
    return;
  }
  lastKnownBid = priceDetails.winningBid; // Update last known bid

  let displayElement = document.getElementById(TRUE_PRICE_ELEMENT_ID);

  if (!displayElement) {
    displayElement = document.createElement('div');
    displayElement.id = TRUE_PRICE_ELEMENT_ID;
    displayElement.className = 'macbid-true-price-display'; // For styling via style.css

    // Add close button
    const closeButton = document.createElement('button');
    closeButton.id = CLOSE_BUTTON_ID;
    closeButton.className = 'macbid-price-overlay-close-btn';
    closeButton.innerHTML = '×'; // "X" symbol
    closeButton.title = 'Hide price overlay';
    closeButton.addEventListener('click', () => {
      showPriceOverlay = false;
      chrome.storage.sync.set({ showPriceOverlay: false }); // Save preference
      removeTruePriceDisplay();
      // Notify popup to update its toggle state
      chrome.runtime.sendMessage({ type: "VISIBILITY_STATE_CHANGED_FROM_PAGE", visible: false }).catch(e => {/*ignore if popup not open*/});
    });
    displayElement.appendChild(closeButton);

    // Insertion logic (try to place it near the bid, fallback to body if fixed)
    const bidPriceDisplayElement = document.querySelector('div.h1.font-weight-normal.text-accent.mb-0'); // Parent of the price
    const bidBlockContainer = bidPriceDisplayElement ? bidPriceDisplayElement.closest('div.d-flex.flex-column.flex-sm-row') : null;

    if (bidBlockContainer && bidBlockContainer.parentElement) {
        bidBlockContainer.insertAdjacentElement('afterend', displayElement);
    } else if (document.body) { // Fallback if fixed positioning is used
        document.body.appendChild(displayElement);
        // console.warn("ContentJS: Ideal insertion point not found for on-page overlay, appended to body.");
    } else {
        // console.error("ContentJS: Cannot find a place to insert the overlay, and document.body is not available.");
        return;
    }
  }

  // Ensure close button is still the first child if element is reused (unlikely with fixed position)
  const existingCloseButton = displayElement.firstChild;
  if (!existingCloseButton || existingCloseButton.id !== CLOSE_BUTTON_ID) {
      // Re-add if missing (should ideally not happen if structure is managed well)
      const closeButton = document.createElement('button'); /* ... create as above ... */
      displayElement.insertBefore(closeButton, displayElement.firstChild);
  }


  // Use a dedicated content area within the display element to avoid overwriting the close button
  let contentContainer = displayElement.querySelector('.price-content-area');
  if (!contentContainer) {
    contentContainer = document.createElement('div');
    contentContainer.className = 'price-content-area';
    // Append content area after the close button
    if(displayElement.children.length > 1 && displayElement.children[0].id === CLOSE_BUTTON_ID) {
        displayElement.insertBefore(contentContainer, displayElement.children[1]);
    } else {
        displayElement.appendChild(contentContainer);
    }
  }

  contentContainer.innerHTML = `
    <div class="price-component">
      <span>Current Bid:</span>
      <span>$${priceDetails.winningBid.toFixed(2)}</span>
    </div>
    <div class="price-component">
      <span>Premium (${priceDetails.buyersPremiumRateApplied.toFixed(1)}%):</span>
      <span>+$${priceDetails.buyersPremiumAmount.toFixed(2)}</span>
    </div>
    <div class="price-component">
      <span>Lot Fee:</span>
      <span>+$${priceDetails.lotFee.toFixed(2)}</span>
    </div>
    <hr style="border: 0; border-top: 1px solid #ddd; margin: 5px 0;">
    <div class="price-component">
      <span>Subtotal (tax base):</span>
      <span>$${priceDetails.subtotalBeforeTax.toFixed(2)}</span>
    </div>
    <div class="price-component">
      <span>Sales Tax (${priceDetails.salesTaxRateApplied.toFixed(2)}%):</span>
      <span>+$${priceDetails.salesTaxAmount.toFixed(2)}</span>
    </div>
    <strong class="total-price">Estimated Total: $${priceDetails.truePrice.toFixed(2)}</strong>
    <small style="display: block; text-align: center; font-size: 0.8em; color: #777;">(Excludes shipping)</small>
  `;

  // Notify popup (if open) that the on-page price has been updated
  chrome.runtime.sendMessage({ type: "PRICE_UPDATED_ON_PAGE" }).catch(e => {/* ignore if popup not open or no listener */});
}

// --- Function to Remove On-Page Price Display ---
function removeTruePriceDisplay() {
  const existingDisplay = document.getElementById(TRUE_PRICE_ELEMENT_ID);
  if (existingDisplay) {
    existingDisplay.remove();
  }
  lastKnownBid = null; // Reset last known bid when display is removed
}

// --- Load Settings from Storage and Initialize ---
const defaultSettings = {
  buyersPremiumRate: 15.0,
  lotFee: 3.00,
  salesTaxRate: 7.0,
  showPriceOverlay: true
};

function loadSettingsAndInitialize() {
  chrome.storage.sync.get(Object.keys(defaultSettings), (result) => {
    currentBuyersPremiumRate = result.buyersPremiumRate !== undefined ? parseFloat(result.buyersPremiumRate) : defaultSettings.buyersPremiumRate;
    currentLotFee = result.lotFee !== undefined ? parseFloat(result.lotFee) : defaultSettings.lotFee;
    currentSalesTaxRate = result.salesTaxRate !== undefined ? parseFloat(result.salesTaxRate) : defaultSettings.salesTaxRate;
    showPriceOverlay = result.showPriceOverlay !== undefined ? result.showPriceOverlay : defaultSettings.showPriceOverlay;

    lastKnownBid = null; // Reset on settings load to force a re-render if visible

    if (showPriceOverlay) {
      calculateAndDisplayTruePrice();
    } else {
      removeTruePriceDisplay();
    }
  });
}

// --- Chrome Message Listener (from Popup) ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "SETTINGS_UPDATED") {
    // Update local settings variables from the message
    if (request.newSettings) {
      currentBuyersPremiumRate = parseFloat(request.newSettings.buyersPremiumRate);
      currentLotFee = parseFloat(request.newSettings.lotFee);
      currentSalesTaxRate = parseFloat(request.newSettings.salesTaxRate);
      showPriceOverlay = request.newSettings.showPriceOverlay;
      lastKnownBid = null; // Force re-render with new settings
    }
    if (showPriceOverlay) {
      calculateAndDisplayTruePrice();
    } else {
      removeTruePriceDisplay();
    }
    sendResponse({ status: "Content script: Settings updated and display refreshed." });
    return true;
  } else if (request.type === "VISIBILITY_TOGGLE") {
    showPriceOverlay = request.show;
    lastKnownBid = null; // Force re-render or removal
    if (showPriceOverlay) {
      calculateAndDisplayTruePrice();
    } else {
      removeTruePriceDisplay();
    }
    sendResponse({ status: "Content script: Visibility toggled." });
    return true;
  } else if (request.type === "GET_PRICE_DETAILS") {
    const priceDetails = getCalculatedPriceDetails();
    if (priceDetails) {
      sendResponse(priceDetails);
    } else {
      sendResponse({ error: "Content script: Could not calculate price details." });
    }
    return true;
  }
});

// --- Mutation Observer for Dynamic Bid Changes ---
const observer = new MutationObserver((mutationsList, obs) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (!showPriceOverlay) { // If overlay is hidden, no need to observe for its updates
        return;
    }

    let potentiallyRelevantChange = false;
    // More specific check: is the bid element's text content part of mutations?
    const bidPriceTextNode = document.querySelector('div.h1.font-weight-normal.text-accent.mb-0 div.d-flex span:last-of-type')?.firstChild;

    for (const mutation of mutationsList) {
        if (mutation.type === 'characterData' && mutation.target === bidPriceTextNode) {
            potentiallyRelevantChange = true;
            break;
        }
        // Broader check for structural changes if the specific text node check is too narrow
        if (mutation.type === 'childList') {
            const bidElementParent = document.querySelector('div.h1.font-weight-normal.text-accent.mb-0 div.d-flex');
            if (bidElementParent && (bidElementParent.contains(mutation.target) || Array.from(mutation.addedNodes).some(node => bidElementParent.contains(node)) || Array.from(mutation.removedNodes).some(node => bidElementParent.contains(node)))) {
                potentiallyRelevantChange = true;
                break;
            }
        }
    }

    if (potentiallyRelevantChange) {
      // console.log("ContentJS (MutationObserver): Debounced - Relevant change detected, recalculating on-page display.");
      calculateAndDisplayTruePrice(); // This will also update lastKnownBid
    }
  }, 300); // 300ms debounce delay
});

function startObserver() {
  // Target the closest stable parent of the bid price for observation
  const bidPriceContainer = document.querySelector('div.h1.font-weight-normal.text-accent.mb-0');
  // Or even 'div.product-details.ml-auto.pb-3' if that's more stable and contains the price

  let targetNodeToObserve = document.body; // Default

  if (bidPriceContainer) {
    targetNodeToObserve = bidPriceContainer;
    // console.log("ContentJS (Observer): Targeting specific bid price container.");
  } else {
    // console.warn("ContentJS (Observer): Specific bid price container not found, falling back to document.body.");
  }

  observer.observe(targetNodeToObserve, {
    childList: true,    // For structural changes (element added/removed)
    subtree: true,      // Observe descendants as well
    characterData: true // For text content changes
  });
}
let lastProcessedUrl = location.href; // Use a different variable name to avoid conflict if 'lastUrl' is used elsewhere

function handleUrlOrSignificantDomChange() {
    // console.log("ContentJS: Handling URL or significant DOM change. New URL:", location.href);
    removeTruePriceDisplay(); // Clear any old display first
    lastKnownBid = null;      // Reset last known bid to ensure new item's price is processed
    // loadSettingsAndInitialize will re-evaluate everything based on current settings and DOM
    // Debounce this re-initialization slightly to allow DOM to settle
    clearTimeout(initialLoadDebounceTimer); // Use one of your existing debounce timers or a new one
    initialLoadDebounceTimer = setTimeout(loadSettingsAndInitialize, 300); // Adjust delay
}

// Listen for history API changes (pushState/replaceState) which SPAs use
// This requires observing for DOM changes that *might* correlate with URL changes
// or injecting code to intercept history API calls (more complex).
// A simpler approach is to periodically check the URL within a broader DOM observer.

const urlChangeObserver = new MutationObserver(() => {
  const currentUrl = location.href;
  if (currentUrl !== lastProcessedUrl) {
    // console.log(`ContentJS: URL changed from ${lastProcessedUrl} to ${currentUrl}`);
    lastProcessedUrl = currentUrl;
    handleUrlOrSignificantDomChange();
  }
});

// Observe the document for any changes that might indicate a navigation
// This is broad, but necessary if direct history API interception is not used.
// The actual processing is debounced via handleUrlOrSignificantDomChange.
// Note: This might be redundant if your main MutationObserver is already broad enough
// and its callback logic correctly identifies item changes.
// However, explicit URL check is often more direct for SPAs.
if (document.body) { // Ensure body exists before observing
    urlChangeObserver.observe(document.body, { childList: true, subtree: true });
} else {
    window.addEventListener('DOMContentLoaded', () => {
        urlChangeObserver.observe(document.body, { childList: true, subtree: true });
    });
}


window.addEventListener('popstate', () => {
    // console.log("ContentJS: 'popstate' event triggered.");
    lastProcessedUrl = location.href; // Update immediately
    handleUrlOrSignificantDomChange();
});


// --- Modify your MutationObserver callback slightly ---
// const observer = new MutationObserver((mutationsList, obs) => {
//   // ... (your existing debounce logic) ...
//   // Inside the debounced function:
//   // if (showPriceOverlay) { // Check this first
//   //    calculateAndDisplayTruePrice(); // This will handle DOM updates if bid changed
//   // }
// });
// The main 'observer' should primarily focus on changes to the bid price value itself
// once an item is loaded. The URL change listener handles the "new item loaded" scenario.


// --- Ensure your initial execution still happens ---
// clearTimeout(initialLoadDebounceTimer);
// initialLoadDebounceTimer = setTimeout(() => {
//     loadSettingsAndInitialize(); // This is your main function to load settings and display
//     startObserver(); // This starts the observer for bid price changes on the current item
// }, 100);
// (The existing initial execution calls are likely fine, but ensure they call loadSettingsAndInitialize)
// --- Initial Execution Logic ---
let initialLoadDebounceTimer = null;
let focusDebounceTimer = null;
let visibilityDebounceTimer = null;

function debouncedLoadSettingsAndInitialize() {
  // console.log("ContentJS: Debounced load settings and initialize.");
  loadSettingsAndInitialize();
}

// Initial load and start observing
clearTimeout(initialLoadDebounceTimer);
initialLoadDebounceTimer = setTimeout(() => {
    debouncedLoadSettingsAndInitialize();
    startObserver(); // Start observer after initial settings load and price calculation
}, 100); // Small delay to ensure page elements might be ready

// Re-check on window focus
window.addEventListener('focus', () => {
  clearTimeout(focusDebounceTimer);
  focusDebounceTimer = setTimeout(debouncedLoadSettingsAndInitialize, 250);
});

// Re-check on page visibility change
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    clearTimeout(visibilityDebounceTimer);
    visibilityDebounceTimer = setTimeout(debouncedLoadSettingsAndInitialize, 250);
  }
});

// Let popup know that content script is ready (optional, if popup needs to know early)
// console.log("Mac.bid True Price: content.js loaded and running.");