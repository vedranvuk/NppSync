// This file is part of NppSync plugin by evilworks.
// Licence: Public Domain.

var NppSyncData = {};
var NppLog = false;

function updateIcon(tabId, show, enabled) {
	if (show) {
		chrome.pageAction.show(tabId);
		if (enabled) {
			chrome.pageAction.setIcon({tabId: tabId, path: "icon_19_enabled.png"});
			chrome.pageAction.setTitle({tabId : tabId, title: "NppSync is enabled."});
		} else {
			chrome.pageAction.setIcon({tabId: tabId, path: "icon_19_disabled.png"});
			chrome.pageAction.setTitle({tabId: tabId, title: "NppSync is disabled."});
		}
	} else { chrome.pageAction.hide(tabId); };
};

function pollResource(tabId, n) {
	var r = new XMLHttpRequest();
	r.open("GET", "http://localhost:40500/" + encodeURIComponent(n), true);
	r.onreadystatechange = function () {
		try {
			if (r.readyState == 4) {
				chrome.tabs.get(tabId, function (tab) {
					if (tab !== undefined) {
						if (NppLog) {
							console.log('Checking file "' + NppSyncData[tabId].files[n] + '".');
						}
						NppSyncData[tabId].checkCount++;
						if (r.responseText != NppSyncData[tabId].files[n].hash) {
							if (NppLog) {
								console.log('Hash of file "' + NppSyncData[tabId].files[n] + '" changed, reload needed.');
							}
							NppSyncData[tabId].files[n].hash = r.responseText;
							NppSyncData[tabId].needsReload = true;
						};
						resetTimer = function(tabID) {
							if (NppSyncData[tabID].enabled) {
								if (NppLog) {
									console.log("Resetting timer.");	
								}
								window.setTimeout(function() {timerCallback(tabID)}, 1000)	
							}							
						}
						if (NppSyncData[tabId].checkCount == NppSyncData[tabId].filesCount) {
							if (NppLog) {
								console.log("Checked all files.");
							}
							NppSyncData[tabId].checkCount = 0;
							if (NppSyncData[tabId].needsReload) {
								if (NppLog) {
									console.log("Reload needed, reloading...");
								}
								chrome.tabs.reload(tabId, {bypassCache : true}, function() {
									NppSyncData[tabId].needsReload = false;
									resetTimer(tabId)
								});
							} else {
								NppSyncData[tabId].needsReload = false;
								resetTimer(tabId)
							}
						};
					} else {
						if (NppLog) {
							console.log(tabId + " is undefined, exiting.");
						}

					}
				});
			};
		}
		catch (e) { console.log(e) }
	};
	try {
		r.send();
	} 
	catch (e) { console.log(e) }
};

function timerCallback(tabId) {
	if (NppLog) {
		console.log("Timer fired.");	
	}
	chrome.tabs.get(tabId, function (tab) {
		if (tab === undefined) {
			if (NppLog) {
				console.log('timerCallback(): Tab ' + tabId + ' not found, aborting.');
			}
			return;
		}
		
		chrome.tabs.sendMessage(tabId, "getResources",
		function (response) {
			if (response === undefined) {
				if (NppLog) {
					console.log("timerCallback(): Tab not yet reloaded, resetting timer.");
				}
				window.setTimeout(function() { timerCallback(tabId) }, 1000);
				return
			}
			try {
				NppSyncData[tabId].filesCount = 0;				
				NppSyncData[tabId].checkCount = 0;
				NppSyncData[tabId].needsReload = false;
				
				var htmlPage = decodeURIComponent(tab.url.split('///')[1]);
				for (var prop in NppSyncData[tabId].files) {
					if ((prop != htmlPage) && (response.indexOf(prop) < 0)) {
						delete NppSyncData[tabId].files[prop]
					}
				}
				
				for (i = 0; i < response.length; i++) {
					e = decodeURIComponent(response[i])
					if (NppSyncData[tabId].files[e] === undefined) {
						NppSyncData[tabId].files[e] = {
							hash : '0'
						};
					}
				}
				
				for (prop in NppSyncData[tabId].files) {
					NppSyncData[tabId].filesCount++;
				}
				
				for (var prop in NppSyncData[tabId].files) {
					pollResource(tabId, prop)
				}
			}
			catch (e) { console.log(e) }
		});
	});
}

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
	if (changeInfo.status != "complete") {
		return
	}
	if (tab.url.indexOf('file:///') < 0) {
		return
	}
	if (NppSyncData === undefined) {
		updateIcon(false, false)
	}
	
	chrome.tabs.executeScript(tabId, {file: "content.js"}, function (r) {
		if (NppSyncData[tabId] === undefined) {
			if (NppLog) {
				console.log("Adding tab " + tabId);
			}
			NppSyncData[tabId] = {
				enabled : false,
				checkCount : 0,
				filesCount : 0,
				needsReload : false,
				files : {}
			}
			NppSyncData[tabId].files[decodeURIComponent(tab.url.split('///')[1])] = {
				hash : '0'
			};
			NppSyncData[tabId].filesCount = 1;
		}
		if (NppSyncData[tabId].enabled) {
			updateIcon(tabId, true, true);
		} else {
			updateIcon(tabId, true, false);
		}
	});
});

chrome.tabs.onRemoved.addListener(function (tabId, removeInfo) {
	try {
		if (NppLog) {
			console.log('Deleting tab ' + tabId + '.');
		}
		delete NppSyncData[tabId];
	}
	catch (e) { console.log(e) }
});

chrome.pageAction.onClicked.addListener(function (tab) {
	try {
		if (!NppSyncData[tab.id].enabled) {
			NppSyncData[tab.id].enabled = true;
			updateIcon(tab.id, true, true);
			window.setTimeout(function () { timerCallback(tab.id) }, 1000);
		} else {
			NppSyncData[tab.id].enabled = false;
			updateIcon(tab.id, true, false);
		}
	}
	catch (e) { console.log(e) }
});
