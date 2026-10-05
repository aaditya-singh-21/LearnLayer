// No network calls or long-lived state. Chrome storage owns progress across worker restarts.
chrome.runtime.onInstalled.addListener(() => { void chrome.storage.local.set({ 'll:version': 1 }); });
