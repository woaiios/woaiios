var formular = "0";
var numBig = "0"
var warnning = "Too Long!";
var errInput = "Err!!";
var oprationTurn = false;
var enterTurn = false;

function updateFormular() {
	if (formular.length >= 20) {
		numBig = warnning;
		updateNumber();
		return;
	}
	$("#fla").text(formular);
}

function updateNumber() {
	$("#numBig").text(numBig);
}

$(document).ready(function() {
	//num
	$(".num").click(function() {
		if (numBig.length > 7 && numBig != errInput && numBig != warnning && oprationTurn == false) {
			return;
		}

		var n = $(this).text();


		if (enterTurn) {
			enterTurn = false;
			numBig = n;
			formular = n;
			updateNumber();
			updateFormular();
			return;
		}

		var flaLastChar = formular.substr(formular.length - 1)
		if (flaLastChar == '÷' && n == '0') {
			numBig = errInput;
			updateNumber();
			return;
		}

		if (numBig == errInput || numBig == warnning) {
			numBig = '0';
			updateNumber();
			return;
		}

		if (oprationTurn) {
			numBig = '0';
			oprationTurn = false;
		}

		if (numBig.length == 1 && numBig == 0) {
			numBig = n;
		} else {
			numBig += n;
		}

		if (formular.length == 1 && formular == '0') {
			formular = n;	
		} else {
			formular += n;	
		}
		
		updateNumber();
		updateFormular();
	});

	//dot
	$("#dot").click(function() {
		if (numBig.indexOf('.')>-1) {
			return;
		}
		numBig += '.';
		formular += '.';
		updateNumber();
		updateFormular();
	});

	//mul
	$("#mul").click(function() {
		if (enterTurn) {
			formular = numBig;
			enterTurn = false; 
		}
		var lastChar = formular.substr(formular.length - 1);
		if (lastChar == '.') {
			return;
		}
		if (lastChar == '×' || lastChar == '÷' || lastChar == '+' || lastChar == '-') {
			formular = formular.replace(/.$/,"×");
		} else {
			formular += '×';
		}
		updateFormular();
		oprationTurn = true;
	});

	//div
	$("#div").click(function() {
		if (enterTurn) {
			formular = numBig;
			enterTurn = false; 
		}

		var lastChar = formular.substr(formular.length - 1);
		if (lastChar == '.') {
			return;
		}

		if (lastChar == '×' || lastChar == '÷' || lastChar == '+' || lastChar == '-') {
			formular = formular.replace(/.$/,"÷");
		} else {
			formular += '÷';
		}
		updateFormular();
		oprationTurn = true;
	});

	//add
	$("#add").click(function() {
		if (enterTurn) {
			formular = numBig;
			enterTurn = false; 
		}

		var lastChar = formular.substr(formular.length - 1);
		if (lastChar == '.') {
			return;
		}
		if (lastChar == '×' || lastChar == '÷' || lastChar == '+' || lastChar == '-') {
			formular = formular.replace(/.$/,"+");
		} else {
			formular += '+';
		}
		updateFormular();
		oprationTurn = true;
	});

	//sub
	$("#sub").click(function() {
		if (enterTurn) {
			formular = numBig;
			enterTurn = false; 
		}

		var lastChar = formular.substr(formular.length - 1);
		if (lastChar == '.') {
			return;
		}
		if (lastChar == '×' || lastChar == '÷' || lastChar == '+' || lastChar == '-') {
			formular = formular.replace(/.$/,"-");
		} else {
			formular += '-';
		}
		updateFormular();
		oprationTurn = true;
	});

	//AC
	$("#AC").click(function() {
		numBig = '0';
		formular = '0';
		updateNumber();
		updateFormular();
	});

	//CE
	$("#CE").click(function() {
		var flaLastChar = formular.substr(formular.length - 1);
		if (flaLastChar == '×' || flaLastChar == '÷' || flaLastChar == '+' || flaLastChar == '-') {
			formular = formular.substr(0, formular.length-1);
			updateFormular();
			return;
		}

		if (numBig == warnning || numBig == errInput) {
			numBig = '0';
			formular = '0';
		}

		if (numBig.length == '1') {
			numBig = '0';
		} else {
			numBig = numBig.substr(0, numBig.length-1);
		}

		if (formular.length == '1') {
			formular = '0';
		} else {
			formular = formular.substr(0, formular.length-1);
		}

		updateNumber();
		updateFormular();
	});

	$("#enter").click(function () {
		enterTurn = true;
		var result = calculatFormular();
		numBig = '' + result;
		updateNumber();
	});
});

function optmizeFormular() {
	var flaLastChar = formular.substr(formular.length - 1);
	if (flaLastChar == '.' || isOprator(flaLastChar)) {
		formular = formular.replace(/.$/,"");
	}
}

function isOprator(flaLastChar) {
	if (flaLastChar == '×' || flaLastChar == '÷' || flaLastChar == '+' || flaLastChar == '-') {
		return true;
	}
	return false;
}

function splitFormular() {
	var length = formular.length;
	var opration = "";
	var oprator = "";
	var ret = [];
	for (var i = 0; i < formular.length; i++) {
		var c = formular[i];
		if (isOprator(c) == false) {
			opration += c;
		} else {
			oprator = c;
			ret.push(opration);
			ret.push(c);
			opration = "";
		}
	}
	ret.push(opration);
	return ret;
}

var Priority = {
	'×':2,
	'÷':2,
	'+':1,
	'-':1
};

function traslateFormular() {
	var arr = splitFormular();
	var stack = [];
	var midArr = [];
	for (var i = 0; i < arr.length; i++) {
		var o = arr[i];
		if (isOprator(o)) {
			while (true) {
				if (stack.length > 0) {
					var oldO = stack[stack.length-1];
					var oldP = Priority[oldO]
					if (Priority[o] <= oldP) {
						oldO = stack.pop();
						midArr.push(oldO);
					} else {
						//oldP < Priority[o]
						stack.push(o);
						break;
					}
				} else {
					stack.push(o);
					break;
				}
			}
		} else {
			midArr.push(o);
		}
	}

	while (true) {
		var o = stack.pop();
		if (o != null || o != undefined) {
			midArr.push(o);
		} else {
			break;
		}
	}

	return midArr;
}

function calculatFormular() {
	optmizeFormular();
	var midFla = traslateFormular();
	if (midFla.length == 1) {
		return midFla[0];
	}

	var stack = [];
	for (var i = 0; i < midFla.length; i++) {
		var o = midFla[i]
		if (isOprator(o)) {
			var s = 0;
			var b = stack.pop();
			var a = stack.pop();
			if (o == '+') {
				s = (a+b);
			}
			if (o == '-') {
				s = (a-b);	
			}
			if (o == '÷') {
				s = (a/b);	
			}
			if (o == '×') {
				s = (a*b);	
			}
			stack.push(s);
		} else {
			stack.push(Number(o));
		}
	}
	var ret  = stack.pop();
	return ret;
}




