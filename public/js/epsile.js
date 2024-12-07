// epsile
// created by djazz

var Epsile = new function () {
	'use strict';

	var domID = function (id) {return document.getElementById(id);};
	var socket;
	var welcomeScreen = domID('welcomeScreen');
	var chatWindow = domID('chatWindow');
	var chatMain = domID('chatMain');
	var chatMainDiv = domID('chatMainDiv');
	var chatArea = domID('chatArea');
	var disconnectButton = domID('disconnectButton');
	var startButton = domID('startButton');
	var typingtimer = null;
	var isTyping = false;
	var isTypingDiv = domID('isTypingDiv');
	var strangerTyping = false;
	var disconnectType = false;
	var peopleOnline = 0;
	var peopleOnlineSpan = domID('peopleOnlineSpan');
	var alertSound = domID('alertSound');
	var isBlurred = false;
	var notify = 0;
	var firstNotify = true;
	var lastNotify = null;
	var notifyTimer = null;
	var url_pattern = /https?:\/\/([-\w\.]+)+(:\d+)?(\/([\w/_\.]*(\?\S+)?)?)?/;

	// Mute the notification sound initially
	alertSound.volume = 0.0;

	function setTyping(state) {
		// Show or hide the typing indicator based on state
		if (state) {
			isTypingDiv.style.display = 'block';
		} else {
			isTypingDiv.style.display = 'none';
		}
		strangerTyping = state;
	}

	function createConnection() {
		socket = io.connect(null, {
			reconnect: false,
			'force new connection': true
		});

		chatMainDiv.innerHTML = "";
		logChat(0, "Connecting to server...");

		socket.on('connect', function () {
			chatMainDiv.innerHTML = "";
			logChat(0, "Waiting for a stranger..");
			setTyping(false);
		});

		socket.on('conn', function () { // Connected with a stranger
			chatMainDiv.innerHTML = "";
			logChat(0, "You are now chatting with a random stranger. Say hi!");
			disconnectButton.disabled = false;
			disconnectButton.value = "Disconnect";
			chatArea.disabled = false;
			chatArea.value = "";
			chatArea.focus();
		});

		socket.on('disconn', function (data) {
			var who = data.who;
			var reason = data.reason;
			chatArea.disabled = true;

			switch (who) {
				case 1:
					logChat(0, "You disconnected.");
					break;
				case 2:
					logChat(0, "Stranger disconnected.");
					if (reason) {
						logChat(0, "Reason: " + reason);
					}
					break;
			}
			clearTimeout(typingtimer);
			isTyping = false;
			setTyping(false);
			disconnectType = true;
			disconnectButton.disabled = false;
			disconnectButton.value = "New";
			chatArea.disabled = true;
			chatArea.focus();
		});

		socket.on('chat', function (message) {
			logChat(2, message);
			alertSound.currentTime = 0;
			if (isBlurred) {
				//alertSound.play();
			}
		});

		socket.on('typing', function (state) {
			setTyping(state);
		});

		socket.on('stats', function (stats) {
			if (stats.people !== undefined) {
				peopleOnlineSpan.innerHTML = stats.people;
			}
		});

		socket.on('disconnect', function () {
			logChat(0, "Connection imploded");
			logChat(-1, "<input type=button value='Reconnect' onclick='Epsile.startChat();'>");
			peopleOnlineSpan.innerHTML = "0";
			chatArea.disabled = true;
			disconnectButton.disabled = true;
			setTyping(false);
			disconnectType = false;
		});
		socket.on('error', function (e) {
			logChat(0, "Connection error");
			logChat(-1, "<input type=button value='Reconnect' onclick='Epsile.startChat();'>");
			peopleOnlineSpan.innerHTML = "0";
			chatArea.disabled = true;
			disconnectButton.disabled = true;
			setTyping(false);
			disconnectType = false;
		});
	}

	function logChat(type, message) {
		var who = "";
		var who2 = "";
		var message2 = message;
		var node = document.createElement("div");
		if(type > 0) {
			if(type===2) {
				who = "<span class='strangerChat'>Stranger: </span>";
				who2 = "Stranger: ";
			}
			else {
				who = "<span class='youChat'>You: </span>";
			}
			if(message.substr(0, 4)==='/me ') {
				message = message.substr(4);
				if(type===2) {
					who = "<span class='strangerChat'>*** Stranger </span>";
					who2 = "*** Stranger ";
				}
				else {
					who = "<span class='youChat'>*** You </span>";
				}
			}
			message = message.replace(/\</g, "&lt;").replace(/\>/g, "&gt;");
			var msg = message.split(" ");
			for(var i=0; i < msg.length; i+=1) {
				if(url_pattern.test(msg[i]) && msg[i].indexOf("\"") === -1) {
					msg[i] = "<a href=\""+msg[i].replace(/\n/g, "")+"\" target=\"_blank\">"+msg[i].replace(/\n/g, "<br>")+"</a>";
				}
				else {
					msg[i] = msg[i].replace(/\n/g, "<br>");
				}
			}
			message = msg.join(" ");
			node.innerHTML = who + message;
		}
		else {
			node.innerHTML = "<span class='consoleChat'>"+message+"</span>";
		}
		chatMainDiv.appendChild(node);
		chatMain.scrollTop = chatMain.scrollHeight;
		chatMain.scrollLeft = 0;
		if(isBlurred && (type === 0 || type === 2)) {
			alertSound.play();
			if(firstNotify && notify > 0 && window.webkitNotifications && window.webkitNotifications.checkPermission() === 0) {
				clearTimeout(notifyTimer);
				if(lastNotify) lastNotify.cancel();
				lastNotify = window.webkitNotifications.createNotification('img/epsile_logo32.png', 'Epsile'+(type===0?' Message':''), who2+message2);
				lastNotify.show();
				firstNotify = false;
				notifyTimer = setTimeout(function () {
					lastNotify.cancel();
				}, 7000);
			}
		}
	}

	this.startChat = function () {
		if(window.webkitNotifications && notify === 0) {
			if(window.webkitNotifications.checkPermission() === 0) {
				notify = 2;
			}
			else {
				window.webkitNotifications.requestPermission();
				notify = 1;
			}
		}
		// Hide welcome screen and show chat window
		welcomeScreen.style.display = 'none';
		chatWindow.style.display = 'flex';

		createConnection();
	};

	this.newStranger = function () {
		if(socket) {
			chatArea.disabled = true;
			disconnectButton.disabled = true;
			socket.emit("new");
			chatArea.value = "";
			chatArea.focus();
			chatMainDiv.innerHTML = "";
			logChat(0, "Waiting for a stranger..");
			setTyping(false);
			disconnectType = false;
			disconnectButton.value = "Disconnect";
		}
	};

	this.doDisconnect = function () {
		if(disconnectType===true) {
			disconnectType = false;
			disconnectButton.value = "Disconnect";
			Epsile.newStranger();
		}
		else if(socket) {
			socket.emit("disconn");
			chatArea.disabled = true;
			chatArea.focus();
			disconnectType = true;
			disconnectButton.disabled = true;
			disconnectButton.value = "Disconnect";
		}
	};

	function onReady() {
		// Initial state: show only welcomeScreen, hide chatWindow
		welcomeScreen.style.display = 'flex';
		chatWindow.style.display = 'none';
		
		startButton.disabled = false;
		startButton.focus();
	}
	setTimeout(onReady, 0);

	function blurred() {
		isBlurred = true;
		firstNotify = true;
	}
	function focused() {
		isBlurred = false;
		if(lastNotify) lastNotify.cancel();
		if(notifyTimer) clearTimeout(notifyTimer);
	}

	window.addEventListener("blur", blurred, false);
	window.addEventListener("focus", focused, false);
	disconnectButton.addEventListener('click', this.doDisconnect, false);
	chatArea.addEventListener("keypress", function (e) {
		var kc = e.keyCode;
		if(kc === 13) {
			if(!e.shiftKey) {
				var msg = chatArea.value;
				if(msg.length > 0) {
					if(typingtimer!==null) {
						clearTimeout(typingtimer);
					}
					if(isTyping) {
						socket.emit("typing", false);
					}
					isTyping = false;
					socket.emit("chat", msg);
					logChat(1, msg);
					chatArea.value = "";
				}
				e.preventDefault();
				e.returnValue = false;
				return false;
			}
		}
	}, false);

	chatArea.addEventListener("keyup", function (e) {
		if (socket) {
			if (typingtimer!==null) {
				clearTimeout(typingtimer);
			}

			if (chatArea.value === "" && isTyping) {
				socket.emit("typing", false); 
				isTyping = false;
			}
			else {
				if (!isTyping && chatArea.value.length > 0) {
					socket.emit("typing", true);
					isTyping = true;
				}
				
				typingtimer = setTimeout(function () {
					if(socket && isTyping) {
						socket.emit("typing", false);
					}
					isTyping = false;
				}, 10000);
			}
		}
	}, false);
};
