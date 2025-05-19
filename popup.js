document.addEventListener('DOMContentLoaded', () => {
  // --- Get DOM Elements ---
  const buyersPremiumInput = document.getElementById('buyersPremiumInput');
  const lotFeeInput = document.getElementById('lotFeeInput');
  const salesTaxInput = document.getElementById('salesTaxInput');
  const visibilityToggle = document.getElementById('visibilityToggle');
  const saveButton = document.getElementById('saveButton');
  const statusElement = document.getElementById('status');

  // Elements for displaying price details within this popup
  const priceDisplayDivInPopup = document.getElementById('price-display-in-popup');
  const loadingPricePInPopup = document.getElementById('popup-loading-price');

  // --- Default Settings Values ---
  const defaultSettings = {
    buyersPremiumRate: 15.0,
    lotFee: 3.00,
    salesTaxRate: 7.0,
    showPriceOverlay: true
  };

  // --- Load Settings from Storage and Initialize UI ---
  chrome.storage.sync.get(Object.keys(defaultSettings), (result) => {
    buyersPremiumInput.value = result.buyersPremiumRate !== undefined ? result.buyersPremiumRate.toFixed(2) : defaultSettings.buyersPremiumRate.toFixed(2);
    lotFeeInput.value = result.lotFee !== undefined ? result.lotFee.toFixed(2) : defaultSettings.lotFee.toFixed(2);
    salesTaxInput.value = result.salesTaxRate !== undefined ? result.salesTaxRate.toFixed(2) : defaultSettings.salesTaxRate.toFixed(2);
    visibilityToggle.checked = result.showPriceOverlay !== undefined ? result.showPriceOverlay : defaultSettings.showPriceOverlay;

    // Attempt to fetch and display price details in the popup when it loads
    fetchPriceDetailsFromContentScript();
  });

  // --- Save Button Click Handler ---
  saveButton.addEventListener('click', () => {
    // Basic validation for numeric inputs
    if (isNaN(parseFloat(buyersPremiumInput.value)) || parseFloat(buyersPremiumInput.value) < 0 ||
        isNaN(parseFloat(lotFeeInput.value)) || parseFloat(lotFeeInput.value) < 0 ||
        isNaN(parseFloat(salesTaxInput.value)) || parseFloat(salesTaxInput.value) < 0) {
      statusElement.textContent = 'Invalid input values. Please enter positive numbers.';
      statusElement.style.color = 'red';
      setTimeout(() => { statusElement.textContent = ''; statusElement.style.color = 'green'; }, 3000);
      return;
    }

    const settingsToSave = {
      buyersPremiumRate: parseFloat(buyersPremiumInput.value),
      lotFee: parseFloat(lotFeeInput.value),
      salesTaxRate: parseFloat(salesTaxInput.value),
      showPriceOverlay: visibilityToggle.checked
    };

    chrome.storage.sync.set(settingsToSave, () => {
      statusElement.textContent = 'Settings saved!';
      statusElement.style.color = 'green';
      setTimeout(() => { statusElement.textContent = ''; }, 2000);

      // Notify content script to update its settings and visibility
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id && tabs[0].url && (tabs[0].url.includes("mac.bid/lots/") || tabs[0].url.includes("mac.bid/?"))) {
          chrome.tabs.sendMessage(tabs[0].id, { type: "SETTINGS_UPDATED", newSettings: settingsToSave }, (response) => {
            if (chrome.runtime.lastError) {
              // console.warn("Popup: Error sending SETTINGS_UPDATED to content script:", chrome.runtime.lastError.message);
            }
            // After saving settings, refresh the price display in the popup
            // as the calculation parameters might have changed.
            fetchPriceDetailsFromContentScript();
          });
        } else {
            // If not on a valid page, still attempt to refresh price display (it will show an appropriate message)
            fetchPriceDetailsFromContentScript();
        }
      });
    });
  });

  // --- Visibility Toggle Change Handler ---
  visibilityToggle.addEventListener('change', () => {
    const show = visibilityToggle.checked;
    // Save this specific setting immediately
    chrome.storage.sync.set({ showPriceOverlay: show });

    // Notify content script about the visibility change
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id && tabs[0].url && (tabs[0].url.includes("mac.bid/lots/") || tabs[0].url.includes("mac.bid/?"))) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "VISIBILITY_TOGGLE", show: show }, (response) => {
          if (chrome.runtime.lastError) {
            // console.warn("Popup: Error sending VISIBILITY_TOGGLE to content script:", chrome.runtime.lastError.message);
          }
        });
      }
    });
  });

  // --- Function to Fetch and Display Price Details in this Popup ---
  function fetchPriceDetailsFromContentScript() {
    if (!priceDisplayDivInPopup || !loadingPricePInPopup) {
        // console.error("Popup: Price display elements not found in popup DOM.");
        return;
    }

    // Clear previous price details and show loading message
    const existingPriceContent = priceDisplayDivInPopup.querySelectorAll("div.price-line, hr, strong.total-popup-price, small");
    existingPriceContent.forEach(el => el.remove()); // Remove only generated content

    loadingPricePInPopup.textContent = "Loading price from page...";
    loadingPricePInPopup.style.display = 'block'; // Ensure loading message is visible

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id && tabs[0].url && (tabs[0].url.includes("mac.bid/lots/") || tabs[0].url.includes("mac.bid/?"))) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "GET_PRICE_DETAILS" }, (response) => {
          if (chrome.runtime.lastError) {
            loadingPricePInPopup.textContent = "Error contacting page: " + chrome.runtime.lastError.message;
            // console.error("Popup: sendMessage error:", chrome.runtime.lastError.message);
            return;
          }

          if (response && response.winningBid !== undefined) {
            loadingPricePInPopup.style.display = 'none'; // Hide loading message

            const detailsHTML = `
              <div class="price-line"><span>Current Bid:</span> <span>$${response.winningBid.toFixed(2)}</span></div>
              <div class="price-line"><span>Premium (${response.buyersPremiumRateApplied.toFixed(1)}%):</span> <span>+$${response.buyersPremiumAmount.toFixed(2)}</span></div>
              <div class="price-line"><span>Lot Fee:</span> <span>+$${response.lotFee.toFixed(2)}</span></div>
              <hr style="margin: 3px 0; border-top: 1px solid #ccc;">
              <div class="price-line"><span>Subtotal:</span> <span>$${response.subtotalBeforeTax.toFixed(2)}</span></div>
              <div class="price-line"><span>Sales Tax (${response.salesTaxRateApplied.toFixed(2)}%):</span> <span>+$${response.salesTaxAmount.toFixed(2)}</span></div>
              <hr style="margin: 3px 0; border-top: 1px solid #ccc;">
              <div class="price-line"><strong>Total:</strong> <strong class="total-popup-price">$${response.truePrice.toFixed(2)}</strong></div>
              <small>(Excludes shipping)</small>
            `;
            // Insert after the h4 and p#popup-loading-price elements, ensuring p is hidden.
            // The loading P is a direct child of priceDisplayDivInPopup.
            // We want to append after it if it's the last child apart from the <h4>
            const h4Title = priceDisplayDivInPopup.querySelector('h4');
            if (h4Title) {
                h4Title.insertAdjacentHTML('afterend', detailsHTML); // Insert after <h4>
            } else {
                priceDisplayDivInPopup.insertAdjacentHTML('beforeend', detailsHTML); // Fallback
            }


          } else if (response && response.error) {
             loadingPricePInPopup.textContent = "Error from page: " + response.error;
          } else {
             loadingPricePInPopup.textContent = "No price data from page. Ensure you are on a Mac.bid lot page.";
          }
        });
      } else {
        loadingPricePInPopup.textContent = "Not on an active Mac.bid lot page.";
      }
    });
  }

  // --- Listen for Messages from Content Script ---
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // If content script indicates the on-page overlay visibility was changed by user (e.g., 'X' button)
    if (request.type === "VISIBILITY_STATE_CHANGED_FROM_PAGE") {
      if (typeof request.visible === 'boolean') {
        visibilityToggle.checked = request.visible;
        // No need to re-save here as content.js should have saved it.
      }
    }
    // If content script indicates the price on the page was updated (e.g., by MutationObserver)
    else if (request.type === "PRICE_UPDATED_ON_PAGE") {
      // console.log("Popup: Received PRICE_UPDATED_ON_PAGE, refreshing popup price.");
      fetchPriceDetailsFromContentScript();
    }
  });

});