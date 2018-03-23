
var countFlag = 1;
var strictFlag = false;
var audioBaseUrl = "https://s3.amazonaws.com/freecodecamp/simonSound";
var audios = ["1.mp3", "2.mp3", "3.mp3", "4.mp3"];

$(document).ready(function() {

	var mapBtn = {
		0:$("#blue"),
		1:$("#red"),
		2:$("#green"),
		3:$("#cyan"),
		4:$("#gray"),
		5:$("#yellow")
	};

	var memoryArr = [];
	var randomArr = [];

	$("#ck").change(function () {
		strictFlag = $(this).prop("checked");
	});

	$("#rBtn").click(function () {
		reset();
		var text = "count: " + countFlag;
		$("#sorce").text(text);
	});

	$("#sBtn").click(function () {
		startAudio()
		var indexes = randomIndexes(countFlag);
		randomArr = indexes;
		console.log(indexes);
		memoryArr = [];
		var index = 0
		function myLoop() {
			setTimeout(function () {
				if (index < indexes.length) {
					blink(mapBtn[indexes[index]]);
					myLoop();
					index += 1;
				}
			}, 300);
		}
		myLoop();
	})

	$("#blue").click(function () {
		blink($("#blue"));
		memoryArr.push(0);
		compare();
	})

	$("#red").click(function () {
		blink($("#red"));
		memoryArr.push(1);
		compare();
	})

	$("#green").click(function () {
		blink($("#green"));
		memoryArr.push(2);
		compare();
	})

	$("#cyan").click(function () {
		blink($("#cyan"));
		memoryArr.push(3);
		compare();
	})

	$("#gray").click(function () {
		blink($("#gray"));
		memoryArr.push(4);
		compare();
	})

	$("#yellow").click(function () {
		blink($("#yellow"));
		memoryArr.push(5);
		compare();
	})

	function compare() {
		var length = Math.min(randomArr.length, memoryArr.length)
		var flag = true;
		for (var i = 0; i < length; i++) {
			if (randomArr[i] != memoryArr[i]) {
				flag = false;
				if (strictFlag) {
					break;
				}
			}
		}
		
		if (flag == false) {
			if (strictFlag) {
				reset();
				var text = "Wrong!! Click Start.";
				$("#sorce").text(text);
			} else {
				var text = "Wrong!! Try again.";
				$("#sorce").text(text);
				memoryArr = [];
			}
		} else {
			if (flag && length > 0 && length == randomArr.length) {
				countFlag += 1;
				var text = 'count: ' + countFlag;
				$("#sorce").text(text);
				memoryArr = [];
				randomArr = [];
				if (countFlag > 20) {
					$("#sorce").text("win!!");
				}
			} else {
				var text = 'count: ' + countFlag;
				$("#sorce").text(text);
			}
		}
	}

	function reset() {
		memoryArr = [];	
		randomArr = [];
		countFlag = 1;
	}
})

function startAudio() {
	playAudio(audioBaseUrl+audios[1]);
}

function twinklAudio() {
	playAudio(audioBaseUrl+audios[0]);
}

function playAudio(url) {
	new Audio(url).play();
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomIndexes(count) {
	var ret = [];
	for (var i = 0; i < count; i++) {
		var num = getRandomInt(0, 5);
		var temp = ret.slice(ret.length - 6,ret.length);
		console.log(temp);
		while (temp.includes(num) == true) {
			num = getRandomInt(0, 5);
		}
		ret.push(num);
	}
	return ret;
}

function blink(obj) {
	twinklAudio();
    obj.fadeTo(100, 0.1).fadeTo(200, 1.0); 
}