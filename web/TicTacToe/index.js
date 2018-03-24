
$(document).ready(function() {
	//var ret = minimax(origBoard, huPlayer);
	$("#page2").hide();

	$("#X").click(function() {
		modeFlag = "X";
		aiPlayer = "O"
		huPlayer = "X"
		aiTurn = false
		$("#page1").hide(200, function() {
			$("#page2").show(function() {
				$("#info").text("Your Turn");
			});	
		});
	});

	$("#O").click(function() {
		modeFlag = "O";
		aiPlayer = "X";
		huPlayer = "O"
		aiTurn = true
		$("#page1").hide(200, function() {
			$("#page2").show(function() {
				aiCheck();
			});
		});
	});

	$(".spot").click(function() {
		if (aiTurn) {
			return;
		}
		var text = $(this).text();
		if (text == "X" || text == "O") {
			return;
		}

		$(this).text(huPlayer);

		var index = parseInt($(this).attr("id"));
		origBoard[index] = huPlayer;

		if (winning(origBoard, huPlayer) == true) {
			$("#info").text("win");
			resetBoard();
		} else if (emptyIndexies(origBoard).length == 0) {
			$("#info").text("draw");
			resetBoard();
		} else {
			aiTurn = true;
			$("#info").text("Waiting AI");
			setTimeout(function() {
				aiCheck();
			}, 160);
		}
	});
});

function resetBoard() {
	setTimeout(function() {
		origBoard = [0, 1, 2, 3, 4, 5, 6, 7, 8];
		$(".spot").text(" ");
		if (modeFlag == "O") {
			aiTurn = true;
			$("#info").text("");
			aiCheck();
		} else {
			aiTurn = false;
			$("#info").text("Your Turn");
		}
	}, 3000);
}

function aiCheck() {
	var k = 0;
	if (emptyIndexies(origBoard).length == 9) {
		k = getRandomInt(0, 8);
		origBoard[k] = aiPlayer;
	} else {
		k = minimax(origBoard, aiPlayer).index;
		origBoard[k] = aiPlayer;
	}
	var elementID = '#' + k; 
	$(elementID).text(aiPlayer);
	if (winning(origBoard, aiPlayer) == true) {
		$("#info").text("AI Win");
		resetBoard();
	} else if (emptyIndexies(origBoard).length == 0) {
		$("#info").text("draw");
		resetBoard();
	} else {
		aiTurn = false;
		$("#info").text("Your Turn");
	}
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

var origBoard = [0, 1, 2, 3, 4, 5, 6, 7, 8];
var aiPlayer = "X";
var huPlayer = "O";
var modeFlag = "O"
var aiTurn = true

function emptyIndexies(board) {
	return board.filter(s => s != "O" && s != "X");
}

function winning(board, player) {
	if ((board[0] == player && board[1] == player && board[2] == player) ||
		(board[3] == player && board[4] == player && board[5] == player) ||
		(board[6] == player && board[7] == player && board[8] == player) ||
		(board[0] == player && board[3] == player && board[6] == player) ||
		(board[1] == player && board[4] == player && board[7] == player) ||
		(board[2] == player && board[5] == player && board[8] == player) ||
		(board[0] == player && board[4] == player && board[8] == player) ||
		(board[2] == player && board[4] == player && board[6] == player)) {
		return true;
	} else {
		return false;
	}
}

function minimax(newBoard, player) {
	var availSpots = emptyIndexies(newBoard);
	if (winning(newBoard, huPlayer)) {
		return {score:-10};
	} else if (winning(newBoard, aiPlayer)) {
		return {score:10};
	} else if (availSpots.length == 0) {
		return {score:0};
	}

	var moves = [];
	for (var i = 0; i < availSpots.length; i++) {
		var move = {};
		move.index = newBoard[availSpots[i]];
		newBoard[availSpots[i]] = player;
		if (player == aiPlayer) {
			var result = minimax(newBoard, huPlayer);
			move.score = result.score;
		} else {
			var result = minimax(newBoard, aiPlayer);
			move.score = result.score;
		}
		newBoard[availSpots[i]] = move.index;
		moves.push(move);
	}

	var bestMove;
	if (player == aiPlayer) {
		var bestScore = -100;
		for (var i = 0; i < moves.length; i++) {
			if (moves[i].score > bestScore) {
				bestScore = moves[i].score;
				bestMove = i;
			}
		}
	} else {
		var bestScore = 100;
		for (var i = 0; i < moves.length; i++) {
			if (moves[i].score < bestScore) {
				bestScore = moves[i].score;
				bestMove = i;
			}
		}
	}

	return moves[bestMove];
}
