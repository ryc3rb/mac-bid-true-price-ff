// --- Configuration Variables (Loaded from storage, with defaults) ---
let currentBuyersPremiumRate = 15.0; // Default 15%
let currentLotFee = 3.00;           // Default $3.00
let currentSalesTaxRate = 7.0;      // Default 7%
let showPriceOverlay = true;        // Default to show the on-page overlay

const TRUE_PRICE_ELEMENT_ID = 'macbid-true-price-extension-display';
const CLOSE_BUTTON_ID = 'macbid-price-overlay-close-btn-id'; // Unique ID for the close button

let lastKnownBid = null; // For comparing if bid changed to optimize DOM updates
let debounceTimer = null; // For debouncing MutationObserver callbacks
let initialLoadDebounceTimer = null;
let focusDebounceTimer = null;
let visibilityDebounceTimer = null;
let lastProcessedUrl = location.href;


// --- Helper Function: Clean Price String ---
function cleanPriceString(priceString) {
  if (!priceString) return null;
  // Removes currency symbols ($, etc.), commas, and any non-numeric characters except the decimal point.
  return parseFloat(priceString.replace(/[^\d.-]/g, '').trim());
}

// --- Function to Get Calculated Price Details (Primarily for Popup) ---
function getCalculatedPriceDetails() {
  // This selector is specific to Mac.bid's current structure and may break if the site changes.
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
  const lotFee = currentLotFee; // Assumes currentLotFee is always a number
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

// --- Helper Function: Create and Configure Close Button ---
function createAndConfigureCloseButton() {
    const closeButton = document.createElement('button');
    closeButton.id = CLOSE_BUTTON_ID;
    closeButton.className = 'macbid-price-overlay-close-btn';
    closeButton.innerHTML = '×'; // "X" symbol
    closeButton.title = 'Hide price overlay';
    closeButton.addEventListener('click', async () => {
      showPriceOverlay = false; // Update global state
      try {
          await chrome.storage.sync.set({ showPriceOverlay: false }); // Save preference
      } catch (e) {
          console.error("ContentJS: Error saving showPriceOverlay state:", e);
      }
      removeTruePriceDisplay();
      // Notify popup to update its toggle state
      chrome.runtime.sendMessage({ type: "VISIBILITY_STATE_CHANGED_FROM_PAGE", visible: false })
            .catch(e => {/*ignore if popup not open or no listener*/});
    });
    return closeButton;
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

    const closeButton = createAndConfigureCloseButton(); // Use the helper
    displayElement.appendChild(closeButton);

    // Insertion logic: These selectors are specific to Mac.bid's current structure.
    const bidPriceDisplayElement = document.querySelector('div.h1.font-weight-normal.text-accent.mb-0');
    const bidBlockContainer = bidPriceDisplayElement ? bidPriceDisplayElement.closest('div.d-flex.flex-column.flex-sm-row') : null;

    if (bidBlockContainer && bidBlockContainer.parentElement) {
        bidBlockContainer.insertAdjacentElement('afterend', displayElement);
    } else if (document.body) { // Fallback if specific insertion point not found
        document.body.appendChild(displayElement);
        // console.warn("ContentJS: Ideal insertion point not found for on-page overlay, appended to body.");
    } else {
        // console.error("ContentJS: Cannot find a place to insert the overlay, and document.body is not available.");
        return; // Critical failure if no body to append to
    }
  } else {
    // Ensure close button is still the first child and correctly configured if displayElement already exists
    let existingCloseButton = displayElement.firstChild;
    if (!existingCloseButton || existingCloseButton.id !== CLOSE_BUTTON_ID || !existingCloseButton.classList.contains('macbid-price-overlay-close-btn')) {
        if (existingCloseButton) existingCloseButton.remove(); // Remove incorrect/old one
        const newCloseButton = createAndConfigureCloseButton(); // Recreate correctly
        displayElement.insertBefore(newCloseButton, displayElement.firstChild);
    }
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
        displayElement.appendChild(contentContainer); // Should append after close button if logic is correct
    }
  }

  // ChatGPT-generated Replacement for unsafe HTML
  const contentContainer = document.createElement("div");

  // Helper to build a row
  function createRow(label, value) {
  const row = document.createElement("div");
  row.className = "price-component";

  const spanLabel = document.createElement("span");
  spanLabel.textContent = label;

  const spanValue = document.createElement("span");
  spanValue.textContent = value;

  row.appendChild(spanLabel);
  row.appendChild(spanValue);
  return row;
}

  // Rows
  contentContainer.appendChild(createRow("Current Bid:", `$${priceDetails.winningBid.toFixed(2)}`));
  contentContainer.appendChild(createRow(`Premium (${priceDetails.buyersPremiumRateApplied.toFixed(1)}%):`, `+$${priceDetails.buyersPremiumAmount.toFixed(2)}`));
  contentContainer.appendChild(createRow("Lot Fee:", `+$${priceDetails.lotFee.toFixed(2)}`));

  // Divider
  const divider = document.createElement("hr");
  divider.style.cssText = "border: 0; border-top: 1px solid #ddd; margin: 5px 0;";
  contentContainer.appendChild(divider);

  // More rows
  contentContainer.appendChild(createRow("Subtotal (tax base):", `$${priceDetails.subtotalBeforeTax.toFixed(2)}`));
  contentContainer.appendChild(createRow(`Sales Tax (${priceDetails.salesTaxRateApplied.toFixed(2)}%):`, `+$${priceDetails.salesTaxAmount.toFixed(2)}`));

  // Estimated total
  const strong = document.createElement("strong");
  strong.className = "total-price";
  strong.textContent = `Estimated Total: $${priceDetails.truePrice.toFixed(2)}`;
  contentContainer.appendChild(strong);

  // Small footer note
  const note = document.createElement("small");
  note.style.cssText = "display: block; text-align: center; font-size: 0.8em; color: #777;";
  note.textContent = "(Excludes shipping)";
  contentContainer.appendChild(note);
  
  // Inject into the existing container
  const original = document.getElementById("contentContainer");
  original.innerHTML = "";
  original.appendChild(contentContainer);

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
  if (chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(Object.keys(defaultSettings), (result) => {
      if (chrome.runtime.lastError) {
        console.error("ContentJS: Error getting settings from chrome.storage.sync:", chrome.runtime.lastError.message);
        currentBuyersPremiumRate = defaultSettings.buyersPremiumRate;
        currentLotFee = defaultSettings.lotFee;
        currentSalesTaxRate = defaultSettings.salesTaxRate;
        showPriceOverlay = defaultSettings.showPriceOverlay;
        console.warn("ContentJS: Using default settings due to storage error.");
      } else {
        currentBuyersPremiumRate = result.buyersPremiumRate !== undefined ? parseFloat(result.buyersPremiumRate) : defaultSettings.buyersPremiumRate;
        currentLotFee = result.lotFee !== undefined ? parseFloat(result.lotFee) : defaultSettings.lotFee;
        currentSalesTaxRate = result.salesTaxRate !== undefined ? parseFloat(result.salesTaxRate) : defaultSettings.salesTaxRate;
        showPriceOverlay = result.showPriceOverlay !== undefined ? result.showPriceOverlay : defaultSettings.showPriceOverlay;
      }

      lastKnownBid = null;
      if (showPriceOverlay) {
        calculateAndDisplayTruePrice();
      } else {
        removeTruePriceDisplay();
      }
    });
  } else {
    console.warn("ContentJS: chrome.storage.sync not available. Using default settings.");
    currentBuyersPremiumRate = defaultSettings.buyersPremiumRate;
    currentLotFee = defaultSettings.lotFee;
    currentSalesTaxRate = defaultSettings.salesTaxRate;
    showPriceOverlay = defaultSettings.showPriceOverlay;
    lastKnownBid = null;
    if (showPriceOverlay) {
      calculateAndDisplayTruePrice();
    } else {
      removeTruePriceDisplay();
    }
  }
}

// --- Chrome Message Listener (from Popup) ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "SETTINGS_UPDATED") {
    if (request.newSettings) {
      currentBuyersPremiumRate = parseFloat(request.newSettings.buyersPremiumRate);
      currentLotFee = parseFloat(request.newSettings.lotFee);
      currentSalesTaxRate = parseFloat(request.newSettings.salesTaxRate);
      showPriceOverlay = request.newSettings.showPriceOverlay;
      lastKnownBid = null;
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
    lastKnownBid = null;
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
  return false; // Indicate that sendResponse will not be called asynchronously for other message types
});

// --- Mutation Observer for Dynamic Bid Changes ---
const observer = new MutationObserver((mutationsList, obs) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (!showPriceOverlay) {
        return;
    }
    let potentiallyRelevantChange = false;
    // This selector is specific to Mac.bid's current structure.
    const bidPriceTextNode = document.querySelector('div.h1.font-weight-normal.text-accent.mb-0 div.d-flex span:last-of-type')?.firstChild;

    for (const mutation of mutationsList) {
        if (mutation.type === 'characterData' && mutation.target === bidPriceTextNode) {
            potentiallyRelevantChange = true;
            break;
        }
        if (mutation.type === 'childList') {
            // This selector is specific to Mac.bid's current structure.
            const bidElementParent = document.querySelector('div.h1.font-weight-normal.text-accent.mb-0 div.d-flex');
            if (bidElementParent && (bidElementParent.contains(mutation.target) || Array.from(mutation.addedNodes).some(node => bidElementParent.contains(node)) || Array.from(mutation.removedNodes).some(node => bidElementParent.contains(node)))) {
                potentiallyRelevantChange = true;
                break;
            }
        }
    }
    if (potentiallyRelevantChange) {
      calculateAndDisplayTruePrice();
    }
  }, 300);
});

function startObserver() {
  // This selector is specific to Mac.bid's current structure.
  const bidPriceContainer = document.querySelector('div.h1.font-weight-normal.text-accent.mb-0');
  let targetNodeToObserve = document.body;
  if (bidPriceContainer) {
    targetNodeToObserve = bidPriceContainer;
  } else {
    // console.warn("ContentJS (Observer): Specific bid price container not found, falling back to document.body.");
  }
  observer.observe(targetNodeToObserve, {
    childList: true, subtree: true, characterData: true
  });
}

function handleUrlOrSignificantDomChange() {
    removeTruePriceDisplay();
    lastKnownBid = null;
    clearTimeout(initialLoadDebounceTimer);
    initialLoadDebounceTimer = setTimeout(loadSettingsAndInitialize, 300);
}

const urlChangeObserver = new MutationObserver(() => {
  const currentUrl = location.href;
  if (currentUrl !== lastProcessedUrl) {
    lastProcessedUrl = currentUrl;
    handleUrlOrSignificantDomChange();
  }
});

// --- Initial Execution Logic & Event Listeners ---
function initializeExtension() {
    // Observe for URL changes that indicate SPA navigation
    if (document.body) {
        urlChangeObserver.observe(document.body, { childList: true, subtree: true });
    } else {
        window.addEventListener('DOMContentLoaded', () => {
            urlChangeObserver.observe(document.body, { childList: true, subtree: true });
        });
    }

    window.addEventListener('popstate', () => {
        lastProcessedUrl = location.href;
        handleUrlOrSignificantDomChange();
    });

    // Initial load and start observing for bid changes
    clearTimeout(initialLoadDebounceTimer);
    initialLoadDebounceTimer = setTimeout(() => {
        loadSettingsAndInitialize();
        startObserver();
    }, 100);

    // Re-check on window focus
    window.addEventListener('focus', () => {
      clearTimeout(focusDebounceTimer);
      focusDebounceTimer = setTimeout(loadSettingsAndInitialize, 250);
    });

    // Re-check on page visibility change
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        clearTimeout(visibilityDebounceTimer);
        visibilityDebounceTimer = setTimeout(loadSettingsAndInitialize, 250);
      }
    });

    // console.log("Mac.bid True Price: content.js initialized.");
}

initializeExtension();
