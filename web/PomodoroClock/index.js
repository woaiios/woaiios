
var green = "rgb(76, 217, 100)";
var red = "rgb(255, 59, 48)";
var black = "rgb(0, 0 ,0)";
var gray = "rgb(153, 153, 153)";
var ctx;

var ClockMode = Object.freeze({"none":1, "work":2, "relax":3, "workPause":4, "relaxPause":5});
var progress = 0.0;
var clockMode = ClockMode.none;
var durtion = 0;

var refTime;
var infoText = 25;
var sessionDurtion = 25 * 60 * 1000;
var breakDurtion = 5 * 60 * 1000;

$(document).ready(function() {
	$("#ClockZone").click(function() {
		if (clockMode == ClockMode.none) {
			clockMode = ClockMode.work;
			durtion = 0;
		} else if (clockMode == ClockMode.work) {
			clockMode = ClockMode.workPause;
		} else if (clockMode == ClockMode.relax) {
			clockMode = ClockMode.relaxPause;
		} else if (clockMode == ClockMode.relaxPause) {
			clockMode = ClockMode.relax;
		} else if (ClockMode.workPause == clockMode) {
			clockMode = ClockMode.work;
		}
	});

	$("#relaxSub").click(function() {
		if (!(clockMode == ClockMode.relaxPause || clockMode == ClockMode.none)) {
			return;
		}
		var relaxTime = parseInt($("#relax").text());
		var temp = relaxTime - 1;
		if (temp >= 1) {
			relaxTime = temp;
		}
		breakDurtion = relaxTime * 60 * 1000;
		$("#relax").text(relaxTime);
		if (clockMode == ClockMode.relaxPause) {
			infoText = relaxTime;
		}
	});

	$("#relaxAdd").click(function() {
		if (!(clockMode == ClockMode.relaxPause || clockMode == ClockMode.none)) {
			return;
		}
		var relaxTime = parseInt($("#relax").text());
		var temp = relaxTime + 1;
		if (temp <= 8 * 60 * 60) {
			relaxTime = temp;
		}
		breakDurtion = relaxTime * 60 * 1000;
		$("#relax").text(relaxTime);
		if (clockMode == ClockMode.relaxPause) {
			infoText = relaxTime;
		}
	});

	$("#workSub").click(function() {
		if (!(clockMode == ClockMode.workPause || clockMode == ClockMode.none)) {
			return;
		}

		var workTime = parseInt($("#work").text());
		var temp = workTime - 1;
		if (temp >= 1) {
			workTime = temp;
		}
		sessionDurtion = workTime * 60 * 1000;
		$("#work").text(workTime);
		infoText = workTime;
	});

	$("#workAdd").click(function() {
		if (!(clockMode == ClockMode.workPause || clockMode == ClockMode.none)) {
			return;
		}

		var workTime = parseInt($("#work").text());
		var temp = workTime + 1;
		if (temp <= 8 * 60 * 60) {
			workTime = temp;
		}
		sessionDurtion = workTime * 60 * 1000;
		$("#work").text(workTime);
		infoText = workTime;		
	});

	ctx = document.getElementById('clock').getContext("2d");
	ctx.imageSmoothingEnabled = true;
	window.requestAnimationFrame(draw);
});

function renderTimer() {
	ctx.lineWidth = 2;
	ctx.textBaseline = "hanging";
	ctx.font = '48px Orbitron';
	ctx.textAlign = "center";
  	ctx.fillText(infoText, 150, 150);
}

function rotate() {
	ctx.translate(150, 150);
	ctx.rotate(-Math.PI/2);
	ctx.translate(-150, -150);
}

function resetTransfrom() {
	ctx.setTransform(1,0,0,1,0,0);
}

function renderGrayRing() {
	ctx.beginPath();
	ctx.lineWidth = 25;
	ctx.strokeStyle = gray;
	ctx.arc(150, 150, 130, 0, Math.PI * 2, false);
	ctx.stroke();
}

function renderRunningRing(progress) {
	rotate();
	ctx.beginPath();
	var color = green;
	if (clockMode == ClockMode.relax || clockMode == ClockMode.relaxPause) {
		color = red;
	}
	ctx.strokeStyle = color;
    ctx.arc(150, 150, 130, 0, Math.PI * 2 * progress, false);
    ctx.stroke();
    resetTransfrom();
}

function durtionToInfoText() {
	var leftDurtion = 0
	if (clockMode == ClockMode.work) {
		leftDurtion = sessionDurtion - durtion;
	}

	if (clockMode == ClockMode.relax) {
		leftDurtion = breakDurtion - durtion;
	}

	var second = parseInt(leftDurtion/1000);
	if (second <= 60) {
		infoText = "" + second;
	} else if (second <= 60 * 60) {
		var m = ("0" + parseInt(second / 60)).slice(-2);
		var s = ("0" + second % 60).slice(-2);
		infoText = "" + m + ":" + s;
	} else {
		var h = ("0" + parseInt(second / 60 / 60)).slice(-2);
		var m = ("0" + parseInt((second - h * 60 * 60) / 60)).slice(-2);
		var s = ("0" + second % (60 * 60)).slice(-2);
		infoText = "" + h + ":" + m + ":" + s
	}
}

function draw() {

	var date = new Date().getTime();
	if (refTime === undefined) {
		refTime = date;
	}
	var tInterVal = date - refTime;
	refTime = date;

	if (clockMode == ClockMode.work) {
		durtion += tInterVal;
		progress = durtion / sessionDurtion;
		if (progress > 1) {
			clockMode = ClockMode.relax;
			durtion = 0;
		}
		durtionToInfoText();
	} else if (clockMode == ClockMode.relax) {
		durtion += tInterVal;
		progress = durtion / breakDurtion;
		if (progress > 1) {
			clockMode = ClockMode.work;
			durtion = 0;
		}
		durtionToInfoText();
	}

	ctx.clearRect(0, 0, 300, 300);
	renderGrayRing();
	renderRunningRing(progress);
    renderTimer();

    window.requestAnimationFrame(draw);
}