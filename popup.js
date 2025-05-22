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

  // --- Helper Function to Check if on a Valid Mac.bid Page for Communication ---
  function isValidMacBidPageForCommunication(tabUrl) {
    if (!tabUrl) return false;
    const isOnMacBidDomain = tabUrl.startsWith("https://www.mac.bid/");
    if (!isOnMacBidDomain) return false;

    const isSearchPage = tabUrl.includes("/search");
    const isLotPathPage = tabUrl.includes("/lot/"); // Singular 'lot' in path
    const isLotQueryPage = tabUrl.includes("?") && tabUrl.includes("lid="); // 'lid=' in query string

    return isSearchPage || isLotPathPage || isLotQueryPage;
  }

  // --- Load Settings from Storage and Initialize UI ---
  chrome.storage.sync.get(Object.keys(defaultSettings), (result) => {
    buyersPremiumInput.value = result.buyersPremiumRate !== undefined ? result.buyersPremiumRate.toFixed(2) : defaultSettings.buyersPremiumRate.toFixed(2);
    lotFeeInput.value = result.lotFee !== undefined ? result.lotFee.toFixed(2) : defaultSettings.lotFee.toFixed(2);
    salesTaxInput.value = result.salesTaxRate !== undefined ? result.salesTaxRate.toFixed(2) : defaultSettings.salesTaxRate.toFixed(2);
    visibilityToggle.checked = result.showPriceOverlay !== undefined ? result.showPriceOverlay : defaultSettings.showPriceOverlay;

    fetchPriceDetailsFromContentScript();
  });

  // --- Save Button Click Handler ---
  saveButton.addEventListener('click', () => {
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

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id && isValidMacBidPageForCommunication(tabs[0].url)) {
          chrome.tabs.sendMessage(tabs[0].id, { type: "SETTINGS_UPDATED", newSettings: settingsToSave }, (response) => {
            if (chrome.runtime.lastError) {
              // console.warn("Popup: Error sending SETTINGS_UPDATED to content script:", chrome.runtime.lastError.message);
            }
            fetchPriceDetailsFromContentScript();
          });
        } else {
            fetchPriceDetailsFromContentScript();
        }
      });
    });
  });

  // --- Visibility Toggle Change Handler ---
  visibilityToggle.addEventListener('change', () => {
    const show = visibilityToggle.checked;
    chrome.storage.sync.set({ showPriceOverlay: show });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id && isValidMacBidPageForCommunication(tabs[0].url)) {
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
        return;
    }

    const existingPriceContent = priceDisplayDivInPopup.querySelectorAll("div.price-line, hr, strong.total-popup-price, small");
    existingPriceContent.forEach(el => el.remove());

    loadingPricePInPopup.textContent = "Loading price from page...";
    loadingPricePInPopup.style.display = 'block';

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id && isValidMacBidPageForCommunication(tabs[0].url)) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "GET_PRICE_DETAILS" }, (response) => {
          if (chrome.runtime.lastError) {
            loadingPricePInPopup.textContent = "Error contacting page: " + chrome.runtime.lastError.message;
            return;
          }

          if (response && response.winningBid !== undefined) {
            loadingPricePInPopup.style.display = 'none';
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
            const h4Title = priceDisplayDivInPopup.querySelector('h4');
            if (h4Title) {
                h4Title.insertAdjacentHTML('afterend', detailsHTML);
            } else {
                priceDisplayDivInPopup.insertAdjacentHTML('beforeend', detailsHTML);
            }
          } else if (response && response.error) {
             loadingPricePInPopup.textContent = "Error from page: " + response.error;
          } else {
             loadingPricePInPopup.textContent = "No price data from page. Ensure you are on a Mac.bid lot page targeted by the extension.";
          }
        });
      } else {
        loadingPricePInPopup.textContent = "Not on an active Mac.bid page targeted by the extension.";
      }
    });
  }

  // --- Listen for Messages from Content Script ---
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "VISIBILITY_STATE_CHANGED_FROM_PAGE") {
      if (typeof request.visible === 'boolean') {
        visibilityToggle.checked = request.visible;
      }
    }
    else if (request.type === "PRICE_UPDATED_ON_PAGE") {
      fetchPriceDetailsFromContentScript();
    }
    // It's good practice to return true for async responses, but since these aren't
    // using sendResponse, it's not strictly necessary here.
    // If you were to add sendResponse in these handlers, you'd need return true.
  });
});