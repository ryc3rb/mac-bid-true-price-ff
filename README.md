# Mac.bid True Price Calculator - Chrome Extension

## Disclaimer

**This extension is an independent project and is NOT officially affiliated with, endorsed by, or connected to Mac.bid or its parent company in any way. It is a third-party tool created to enhance the user experience on mac.bid auction pages. Use at your own discretion. The accuracy of calculations depends on the stability of the Mac.bid website structure, which can change without notice.**

**There is NO WARRANTY provided with this software, express or implied. The author is not responsible for any financial decisions made based on the information provided by this extension, nor for any issues that may arise from its use.**

---

## Overview

The "Mac.bid True Price Calculator" is a Google Chrome extension designed to help users quickly see an estimated "true price" for items on Mac.bid auction pages. It automatically calculates and displays an estimated final cost by factoring in:

*   The current bid price
*   A buyer's premium (configurable)
*   A lot fee (configurable)
*   Sales tax (configurable)

This helps users make more informed bidding decisions by providing a clearer picture of the potential total out-of-pocket expense if they win an auction.

## Features

*   **Automatic Price Calculation:** Scrapes the current bid from Mac.bid auction pages.
*   **Configurable Fees:**
    *   Set your local Sales Tax Rate (%).
    *   Adjust the Buyer's Premium Rate (%).
    *   Set the per-item Lot Fee ($).
*   **On-Page Display:** Shows a breakdown of the estimated costs directly on the auction page.
    *   **Toggle Visibility:** Show or hide the on-page price overlay.
    *   **Configurable Position:** Choose where the on-page overlay appears (e.g., bottom-right, top-left).
*   **Popup Interface:**
    *   View estimated price details.
    *   Access and modify all configurable settings.
*   **Dynamic Updates:** Attempts to update the price as bids change on the page (using a MutationObserver).
*   **SPA Navigation Support:** Designed to work with Mac.bid's dynamic page loading for different items.

## Installation (from GitHub - for development/testing)

1.  **Download:** Clone this repository or download it as a ZIP file and extract it to a local folder on your computer.
2.  **Open Chrome Extensions:** Open Google Chrome, navigate to `chrome://extensions`.
3.  **Enable Developer Mode:** Ensure the "Developer mode" toggle in the top-right corner is switched ON.
4.  **Load Unpacked:** Click the "Load unpacked" button.
5.  **Select Folder:** Navigate to and select the folder where you extracted the extension files (the folder containing `manifest.json`).
6.  The extension should now be installed and active.

## How to Use

1.  **Navigate to a Mac.bid auction page** (e.g., `https://www.mac.bid/?aid=...&lid=...` or `https://www.mac.bid/lots/...`).
2.  **On-Page Overlay:** If enabled (default), a floating box will appear (default bottom-right) showing the "Estimated Total" and a breakdown of costs.
    *   You can close this overlay using the "X" button on the overlay itself.
3.  **Extension Popup:**
    *   Click the extension's icon in your Chrome toolbar.
    *   **Estimated Price Details:** The top section will show the calculated price breakdown for the current item.
    *   **Settings:**
        *   Adjust the "Buyer's Premium Rate," "Lot Fee," and "Your Sales Tax Rate."
        *   Toggle the "Show Price Overlay on Page" on or off.
        *   Select the desired "Overlay Position" for the on-page display.
    *   Click "Save Settings" to apply and persist your changes.

## Screenshots

Here's a quick look at the extension in action:
![image](/images/example.png)

## Known Limitations & Considerations

*   **Website Structure Dependent:** The extension relies on specific HTML structures (CSS selectors) of the Mac.bid website to find the current bid price. If Mac.bid changes its website design, the extension may stop working correctly or entirely until the selectors in `content.js` are updated.
*   **Dynamic Content:** While the extension uses a `MutationObserver` to detect bid changes, highly dynamic sites can sometimes present challenges. The display should update, but there might be slight delays.
*   **Sales Tax Calculation:** Sales tax is calculated on the subtotal (Bid + Premium + Lot Fee). This may not reflect the exact tax calculation method for all jurisdictions or item types.
*   **Shipping Costs:** This extension **does not** factor in shipping costs, which can be a significant additional expense.
*   **Performance:** The extension tries to be performant, but observing DOM changes can have an impact on complex pages. If you notice issues, ensure the on-page overlay is only enabled when needed or report the issue.

## Contributing (Optional)

If you'd like to contribute, please feel free to fork the repository, make your changes, and submit a pull request. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the MIT License - see the [LICENSE.MD](https://github.com/adonnan/mac-bid-true-price/blob/main/LICENSE.md) file for details.
