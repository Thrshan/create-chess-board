/**
 * This file is loaded via the <script> tag in the index.html file and will
 * be executed in the renderer process for that window. No Node.js APIs are
 * available in this process because `nodeIntegration` is turned off and
 * `contextIsolation` is turned on. Use the contextBridge API in `preload.js`
 * to expose Node.js functionality from the main process.
 */

const canvas = document.getElementById("canvas-board");
const GRID_SIZE = 64;
const board_height = GRID_SIZE * 8;
const board_width = GRID_SIZE * 8;
const FILE_LABEL_HEIGHT = 25;
const RANK_LABEL_WIDTH = 25;
const TOP_BOARD_MARGIN = 0;
const BOTTOM_BOARD_MARGIN = FILE_LABEL_HEIGHT;
const LEFT_BOARD_MARGIN = RANK_LABEL_WIDTH;
const RIGHT_BOARD_MARGIN = 0;
canvas.width = board_width + LEFT_BOARD_MARGIN + RIGHT_BOARD_MARGIN;
canvas.height = board_height + TOP_BOARD_MARGIN + BOTTOM_BOARD_MARGIN;

var ctx = canvas.getContext('2d');
const initPositionDict = {
    D: {
        // Dark
        B: ["C8", "F8"],
        K: ["E8"],
        N: ["B8", "G8"],
        P: ["A7", "B7", "C7", "D7", "E7", "F7", "G7", "H7"],
        Q: ["D8"],
        R: ["A8", "H8"],
    },
    L: {
        // Light
        B: ["C1", "F1"],
        K: ["E1"],
        N: ["B1", "G1"],
        P: ["A2", "B2", "C2", "D2", "E2", "F2", "G2", "H2"],
        Q: ["D1"],
        R: ["A1", "H1"],
    },
};

let squares = new Object();

for (var i = 0; i < 8; i++) {
    for (var j = 0; j < 8; j++) {
        squares[String.fromCharCode(65+i) + (8-j)] = {'X':(i*GRID_SIZE) + LEFT_BOARD_MARGIN, 'Y':(j*GRID_SIZE) + TOP_BOARD_MARGIN};
    }
}

function isPointInsideArea(point, areaPoints) {
    var v0 = { x: areaPoints[1].x - areaPoints[0].x, y: areaPoints[1].y - areaPoints[0].y };
    var v1 = { x: areaPoints[3].x - areaPoints[0].x, y: areaPoints[3].y - areaPoints[0].y };
    var v2 = { x: point.x - areaPoints[0].x, y: point.y - areaPoints[0].y };

    var dot00 = v0.x * v0.x + v0.y * v0.y;
    var dot01 = v0.x * v1.x + v0.y * v1.y;
    var dot02 = v0.x * v2.x + v0.y * v2.y;
    var dot11 = v1.x * v1.x + v1.y * v1.y;
    var dot12 = v1.x * v2.x + v1.y * v2.y;

    var invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
    var u = (dot11 * dot02 - dot01 * dot12) * invDenom;
    var v = (dot00 * dot12 - dot01 * dot02) * invDenom;

    // Adjust conditions to handle the parallelogram correctly
    return (u >= 0 && u <= 1 && v >= 0 && v <= 1);
}

class State {
    static isDragging = false;
    static mouseDownPieceOffsetPos = new Object; // {'X': 22, 'Y': 23}
    static selectedPiece = null;
    static addPiece = false;
    static pieceToAdd = null;
    static isAddArrow = false;
    static selectedArrow = null;
    static addArrowEnabled = false;
    static arrowProperty = {color:null};
}


function create_board() {
    ctx.fillStyle = 'rgb(250, 250, 250)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (var x = 0; x < board_height; x += GRID_SIZE) {
        for (var y = 0; y < board_width; y += GRID_SIZE) {
            var isDarkSquare = (Math.floor(x / GRID_SIZE) % 2 === Math.floor(y / GRID_SIZE) % 2);

            if (isDarkSquare) {
                ctx.fillStyle = 'rgb(240, 217, 181)';
            } else {
                ctx.fillStyle = 'rgb(181, 136, 99)';
            }

            ctx.fillRect(LEFT_BOARD_MARGIN + y, TOP_BOARD_MARGIN + x, GRID_SIZE, GRID_SIZE);
        }
    }


    ctx.font="bold 20px Calibri";
    ctx.textAlign="center"; 
    ctx.textBaseline = "middle";

    let rectFill = null;
    let rectStroke = null;
    let textFill = null;

    for (var i = 0; i < 8; i++) {
        if (i % 2 == 0){
            rectFill = '#FFFFFF';
            rectStroke = "#000000";
            textFill = "#000000";
        } else {
            rectFill = '#000000';
            rectStroke = "#000000";
            textFill = "#FFFFFF";
        }
        ctx.fillStyle = rectFill;
        ctx.strokeStyle = rectStroke;
        ctx.fillRect(0, i * GRID_SIZE, LEFT_BOARD_MARGIN, GRID_SIZE);
        ctx.strokeRect(0, i * GRID_SIZE, LEFT_BOARD_MARGIN, GRID_SIZE);
        
        const rank = 8-i
        ctx.fillStyle = textFill;
        ctx.fillText(rank, 0+(LEFT_BOARD_MARGIN/2),(i * GRID_SIZE)+(GRID_SIZE/2));
    }

    for (var i = 0; i < 8; i++) {
        if (i % 2 != 0){
            rectFill = '#FFFFFF';
            rectStroke = "#000000";
            textFill = "#000000";
        } else {
            rectFill = '#000000';
            rectStroke = "#000000";
            textFill = "#FFFFFF";
        }
        ctx.fillStyle = rectFill;
        ctx.strokeStyle = rectStroke;
        ctx.fillRect(LEFT_BOARD_MARGIN + (i * GRID_SIZE), board_height, GRID_SIZE, FILE_LABEL_HEIGHT);
        ctx.strokeRect(LEFT_BOARD_MARGIN + (i * GRID_SIZE), board_height, GRID_SIZE, FILE_LABEL_HEIGHT);
        
        const file = String.fromCharCode(i + 65);
        ctx.fillStyle = textFill;
        ctx.fillText(file, (LEFT_BOARD_MARGIN + (i * GRID_SIZE)) + (GRID_SIZE/2), board_height+(FILE_LABEL_HEIGHT/2) + 1);
    }

}

class Piece {
    constructor(pieceCode, img, lastPosName) {
        this.pieceCode = pieceCode;
        this.img = img;
        this.placedPosName = lastPosName;
        this.placedPos = Object();
        Object.assign(this.placedPos, squares[this.placedPosName]);
        this.currPosName = lastPosName;
        this.currPos = Object();
        Object.assign(this.currPos, squares[this.currPosName]);
    }

    draw () {
        ctx.drawImage(this.img, this.currPos.X, this.currPos.Y, 64, 64);
    }

    move (posX, posY) {
        this.currPos.X = posX;
        this.currPos.Y = posY;
    } 

    place (squareName) {
        this.placedPosName = squareName;
        this.currPosName = squareName;
        Object.assign(this.placedPos, squares[squareName]);
        Object.assign(this.currPos, squares[squareName]);
    } 

    // Create a function to set placement position
}

class Arrow {
    constructor(startSquare, color, opacity) {
        this.startSquare = startSquare;
        this.color = color;
        this.highliteColor = '#D2DE32';
        this.opacity = opacity;
        this.endSquare = "OO";
        this.lineWidth = 15;
        this.arrowHeadWidth = 30;
        this.arrowHeadLength = 27;
        this.lengthEmphasis = 5; // aesthetic correction
        this.highlite = false;
    }

    draw () {
        if(this.endSquare != "OO" && this.startSquare != this.endSquare){
            const startPos = Object();
            Object.assign(startPos, squares[this.startSquare]);
            const endPos = Object();
            Object.assign(endPos, squares[this.endSquare]);
            ctx.strokeStyle = this.color;
            if (this.highlite){
                ctx.fillStyle = this.highliteColor;
            } else {
                ctx.fillStyle = this.color;
            }

            const horizEndPosComponent = Object()
            Object.assign(horizEndPosComponent, squares[this.endSquare[0] + this.startSquare[1]]);
            const arrowLen = Math.sqrt(Math.pow((startPos.X - endPos.X), 2) + Math.pow((startPos.Y - endPos.Y), 2));
            const arrowRectLen = arrowLen - this.arrowHeadLength + this.lengthEmphasis;
            const arrowHorizComponentLen = Math.sqrt(Math.pow((startPos.X - horizEndPosComponent.X), 2) + Math.pow((startPos.Y - horizEndPosComponent.Y), 2))
            let angle = Math.acos(arrowHorizComponentLen / arrowLen);
            ctx.translate(startPos.X + (GRID_SIZE/2), startPos.Y + (GRID_SIZE/2));
            if (endPos.X < startPos.X && endPos.Y > startPos.Y){
                angle = angle + (2* ((Math.PI / 2) - angle));
            } else if (endPos.X <= startPos.X && endPos.Y <= startPos.Y){
                angle = angle + ((Math.PI / 2) * 2);
            } else if (endPos.X > startPos.X && endPos.Y < startPos.Y){
                angle = angle + (((Math.PI / 2) * 2) + (2* ((Math.PI / 2) - angle)));
            }
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.roundRect(0, -this.lineWidth/2, arrowRectLen, this.lineWidth, [3, 0, 0, 3]);
            ctx.fill();
            // ctx.fillRect(0, -this.lineWidth/2, arrowRectLen, this.lineWidth);

            ctx.beginPath();
            ctx.moveTo(arrowRectLen , -this.arrowHeadWidth/2);
            ctx.lineTo(arrowRectLen , this.arrowHeadWidth/2);
            ctx.lineTo(arrowRectLen + this.arrowHeadLength , 0);
            ctx.closePath();
            ctx.fill();

            ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
    }

    move (posX, posY) {
        this.currPos.X = posX;
        this.currPos.Y = posY;
    } 

    place (squareName) {
        this.placedPosName = squareName;
        this.currPosName = squareName;
        Object.assign(this.placedPos, squares[squareName]);
        Object.assign(this.currPos, squares[squareName]);
    } 

    setArrowEnd (endSquare) {
        this.endSquare = endSquare;
    }

    // Create a function to set placement position
}

class PiecesGroup{
    constructor() {
        this.pieces = [];
    }

    add(piece) {
        this.pieces.push(piece);
    }

    draw(){
        for (const piece of this.pieces) {
            piece.draw();
        }

        if(State.isDragging){
            State.selectedPiece.draw();
        }
    }

    clickedPiece(squareName){
        for (const piece of this.pieces) {
            if (piece.placedPosName === squareName){
                return piece;
            }
        }
        return null;
    }

    removePiece (squareName) {
        for (var i = 0; i < this.pieces.length; i++)  {
            if (this.pieces[i].placedPosName === squareName){
                break
            }
        }
        this.pieces.splice(i, 1);
    }
}

class ArrowGroup{
    constructor() {
        this.arrows = [];
    }

    add(arrow) {
        this.arrows.push(arrow);
    }

    draw(){
        for (const arrow of this.arrows) {
            arrow.draw();
        }
    }

    mouseOnArrow(mouseX, mouseY){
        for (const arrow of this.arrows) {
            let A = Object();
            Object.assign(A, squares[arrow.startSquare]);
            let B = Object();
            Object.assign(B, squares[arrow.endSquare]);
            A.X = A.X + (GRID_SIZE/2);
            B.X = B.X + (GRID_SIZE/2);
            A.Y = A.Y + (GRID_SIZE/2)+0.00001;
            B.Y = B.Y + (GRID_SIZE/2);
            // const f = (x) => ((x-A.X)*(B.Y - A.Y)/(B.X - A.X)) + A.Y;
            const m = (B.Y - A.Y) / (B.X - A.X);
            const Pm = -1/m;
            // const bA = A.Y - (Pm * A.X);
            // const bB = B.Y - (Pm * B.X);
            const linedetectWidth = (arrow.lineWidth / 2) + 2;
            const Px = A.X + (linedetectWidth / Math.sqrt(1 + Math.pow(Pm, 2)));
            const Py = A.Y + ((linedetectWidth * Pm) / Math.sqrt(1 + Math.pow(Pm, 2)));
            const Qx = B.X + (linedetectWidth / Math.sqrt(1 + Math.pow(Pm, 2)));
            const Qy = B.Y + ((linedetectWidth * Pm) / Math.sqrt(1 + Math.pow(Pm, 2)));
            const Rx = A.X - (linedetectWidth / Math.sqrt(1 + Math.pow(Pm, 2)));
            const Ry = A.Y - ((linedetectWidth * Pm) / Math.sqrt(1 + Math.pow(Pm, 2)));
            const Sx = B.X - (linedetectWidth / Math.sqrt(1 + Math.pow(Pm, 2)));
            const Sy = B.Y - ((linedetectWidth * Pm) / Math.sqrt(1 + Math.pow(Pm, 2)));

            const inside = isPointInsideArea({ x: mouseX, y: mouseY }, [
                { x: Px, y: Py },
                { x: Rx, y: Ry },
                { x: Sx, y: Sy },
                { x: Qx, y: Qy }
            ]);
            if (inside){
                arrow.highlite = true;
            } else {
                arrow.highlite = false;
            }
        }
    }

    removeSelectedArrow () {
        let res = 0;
        for (var i = 0; i < this.arrows.length; i++)  {
            if (this.arrows[i].highlite){
                res = 1;
                break
            }
        }
        this.arrows.splice(i, 1);
        return res;
    }
}

let pieceImgObj = new Object
let piecesGroup = new PiecesGroup;
let arrowGroup = new ArrowGroup;
async function loadAssets() {
    let piecesCodes = ["DB", "DK", "DN", "DP", "DQ", "DR", "LB", "LK", "LN", "LP", "LQ", "LR"]
    for (const pieceCode of piecesCodes) {
        let img = new Image();
        img.src = `./assets/pieces_classic/${pieceCode}.svg`
        await img.decode();
        pieceImgObj[pieceCode] = img;

        const pieceColor = pieceCode[0];
        const pieceType = pieceCode[1];
        for (const place_pos_name of initPositionDict[pieceColor][pieceType]) {
            piecesGroup.add(new Piece(pieceCode, img, place_pos_name))
    }
}
}
const promise = loadAssets();
create_board()

promise.then( () => {
    animate();
});

function animate(){
    requestAnimationFrame(animate);
    ctx.clearRect(0,0,canvas.width, canvas.heigh);
    create_board();
    piecesGroup.draw();
    arrowGroup.draw();
}

function onMouseDown(event) {
    if (!State.addPiece && !State.addArrowEnabled){
        if (event.button === 0){
            const rect = canvas.getBoundingClientRect();
            const posX = event.clientX - rect.left - LEFT_BOARD_MARGIN;
            const posY = event.clientY - rect.top - TOP_BOARD_MARGIN;


            const rankNo = 8 - Math.floor(posY / 64);
            const fileChar = String.fromCharCode(Math.floor(posX / 64) + 65);
            let squareName = fileChar+rankNo;


            State.selectedPiece = piecesGroup.clickedPiece(squareName);
            if (State.selectedPiece) {
                State.isDragging = true;

                State.mouseDownPieceOffsetPos = {
                    X: posX - Math.floor(posX / 64) * 64,
                    Y: posY - Math.floor(posY / 64) * 64
                }
            }
        } else if (event.button === 2) {
            const rect = canvas.getBoundingClientRect();
            const posX = event.clientX - rect.left - LEFT_BOARD_MARGIN;
            const posY = event.clientY - rect.top - TOP_BOARD_MARGIN;


            const rankNo = 8 - Math.floor(posY / 64);
            const fileChar = String.fromCharCode(Math.floor(posX / 64) + 65);
            let squareName = fileChar+rankNo;
            const res = arrowGroup.removeSelectedArrow ();
            if (res == 1) return;
            piecesGroup.removePiece(squareName);
        }
    } else if (State.addArrowEnabled) {
        State.isAddArrow = true;
        const rect = canvas.getBoundingClientRect();
        const posX = event.clientX - rect.left - LEFT_BOARD_MARGIN;
        const posY = event.clientY - rect.top - TOP_BOARD_MARGIN;

        const rankNo = 8 - Math.floor(posY / 64);
        const fileChar = String.fromCharCode(Math.floor(posX / 64) + 65);
        let squareName = fileChar+rankNo;
        const arrow = new Arrow(squareName, State.arrowProperty.color, 1);
        arrowGroup.add(arrow);
        State.selectedArrow = arrow;
    }
}

function onMouseMove(event){
    if (event.button === 0){
        if(State.isDragging || State.addPiece){
            const rect = canvas.getBoundingClientRect();
            const posX = event.clientX - rect.left - State.mouseDownPieceOffsetPos.X;
            const posY = event.clientY - rect.top - State.mouseDownPieceOffsetPos.Y;

            State.selectedPiece.move(posX, posY);

        } else if (State.isAddArrow) {
            const rect = canvas.getBoundingClientRect();
            const posX = event.clientX - rect.left - LEFT_BOARD_MARGIN;
            const posY = event.clientY - rect.top - TOP_BOARD_MARGIN;
             
            const rankNo = 8 - Math.floor(posY / 64);
            const fileChar = String.fromCharCode(Math.floor(posX / 64) + 65);
            let squareName = fileChar+rankNo;
            if (State.selectedArrow) {
                State.selectedArrow.setArrowEnd(squareName);
            }
        } else if (!State.addArrowEnabled){
            const rect = canvas.getBoundingClientRect();
            const posX = event.clientX - rect.left;
            const posY = event.clientY - rect.top;
            arrowGroup.mouseOnArrow(posX, posY);
            
        }
    }   
}

function onMouseUp(event){
    if (event.button === 0){
        if (State.isDragging || State.addPiece){
            
            const rect = canvas.getBoundingClientRect();
            const posX = event.clientX - rect.left - LEFT_BOARD_MARGIN;
            const posY = event.clientY - rect.top - TOP_BOARD_MARGIN;


            const rankNo = 8 - Math.floor(posY / 64);
            const fileChar = String.fromCharCode(Math.floor(posX / 64) + 65);
            let squareName = fileChar+rankNo;


            const isPieceAtSquare = piecesGroup.clickedPiece(squareName);
            if (isPieceAtSquare === null){
                State.selectedPiece.place(squareName);
            } else {
                if (State.addPiece){
                    piecesGroup.removePiece("O");
                } else {
                    State.selectedPiece.place(State.selectedPiece.placedPosName);
                }

                // State.selectedPiece.place(State.selectedPiece.placedPosName);
            }
            State.selectedPiece = null;
            State.isDragging = false;
            State.addPiece = false;
        } else if (State.isAddArrow) {
            State.isAddArrow = false;
            State.arrowToAdd = null;
            State.selectedArrow = null;
        }
    }
}

canvas.addEventListener('mousedown', (event) => onMouseDown(event));
canvas.addEventListener('mousemove', (event) => onMouseMove(event));
canvas.addEventListener('mouseup', (event) => onMouseUp(event));


const addPieceButtons = document.getElementsByClassName("add-piece-button");

for (var addPieceButton of addPieceButtons) {
    addPieceButton.addEventListener("mousedown", (event) => addPiece(event));
    addPieceButton.ondragstart = function() { return false; };
}

const addArrowButtons = document.getElementsByClassName("add-arrow");

for (var addArrowButton of addArrowButtons) {
    addArrowButton.addEventListener("mousedown", (event) => addArrow(event));
    addArrowButton.ondragstart = function() { return false; };
}


function addPiece(e){
    State.addPiece = true;
    State.pieceToAdd = e.target.getAttribute("name");
    // State.pieceToAdd = e.target.name;
    const rect = e.target.getBoundingClientRect();
    const pickSymbolPieceFactor = 60 / 50;
    State.selectedPiece = new Piece(State.pieceToAdd , pieceImgObj[State.pieceToAdd], "O")
    State.mouseDownPieceOffsetPos = {
        X: (e.clientX - rect.left)*pickSymbolPieceFactor,
        Y: (e.clientY - rect.top)*pickSymbolPieceFactor
    }
    piecesGroup.add(State.selectedPiece);
}

function addArrow(e){
    e.target.style.background = "green";
    if (e.target.getAttribute("state") == "off"){
        const addArrowButtons = document.getElementsByClassName("add-arrow");
        for (var addArrowButton of addArrowButtons) {
            addArrowButton.setAttribute("state", "off");
            addArrowButton.style.background = "gray";
        }
        e.target.setAttribute("state", "on");
        e.target.style.background = "green";

        State.addArrowEnabled = true;
        State.isAddArrow = true;
        State.arrowProperty.color = e.target.getAttribute("color");
    } else {
        e.target.setAttribute("state", "off");
        e.target.style.background = "gray";
        State.addArrowEnabled = false;
        State.isAddArrow = false;
        State.arrowProperty.color = null;
    }
}

const copyBtnElem = document.getElementById("copy-button");
copyBtnElem.addEventListener('click', copyImageToClipboard);



function copyImageToClipboard() {

    // var tempCanvas = document.createElement('canvas');
    // tempCanvas.width = 372;
    // tempCanvas.height = 372;
    // var tempCtx = tempCanvas.getContext('2d');

    // // Draw the content from the original canvas to the temporary canvas with resizing
    // tempCtx.drawImage(canvas, 0, 0, 372, 372);

    // tempCanvas.toBlob(function (blob) {
    canvas.toBlob(function (blob) {
        navigator.clipboard.write([
            new ClipboardItem({
                'image/png': blob
            })
        ]).then(function () {
            alert('Image copied to clipboard. You can now paste it into notes or other applications.');
        }).catch(function (error) {
            console.error('Copy to clipboard failed: ', error);
            alert('Copy to clipboard failed. Please use manual methods to copy the image.');
        });
    });
}

function saveImage() {
    canvas.toBlob(function (blob) {
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'chessboard.png'; // Specify the file name and extension
        link.click();
    });
}

const snapPreviewContElem = document.getElementById("stack-boaeds-preview");
const snapBtnElem = document.getElementById("snap-shot-board");
const safeGifBtnElem = document.getElementById("save-gif");
snapBtnElem.addEventListener('click', snapBoard);
safeGifBtnElem.addEventListener('click', saveGif);
let board_blob_snaps = [];
// var urlCreator = window.URL || window.webkitURL;
var encoder = new GIFEncoder();
encoder.setRepeat(0); //0  -> loop forever
encoder.setDelay(500)
encoder.start();
function snapBoard() {


    // canvas.toBlob(function (blob) {
    //     board_blob_snaps.push(blob);
    //     var imageElem = document.createElement("img");
    //     imageElem.src = URL.createObjectURL(board_blob_snaps[0]);
    //     snapPreviewContElem.appendChild(imageElem);
    // });

    // var imageElem = document.createElement("img");
    // imageElem.height=100;
    // imageElem.width=100;
    // imageElem.src = getCanvasImage();
    


    var tempCanvas = document.createElement('canvas');
    tempCanvas.width = 200;
    tempCanvas.height = 200;
    var tempCtx = tempCanvas.getContext('2d');

    // Draw the content from the original canvas to the temporary canvas with resizing
    tempCtx.drawImage(canvas, 0, 0, 200, 200);
    
    encoder.addFrame(tempCtx)
    tempCanvas.toBlob(function (blob) {
    //         board_blob_snaps.push(blob);
            var imageElem = document.createElement("img");
            imageElem.height=100;
            imageElem.width=100;
            imageElem.src = URL.createObjectURL(blob);
            snapPreviewContElem.appendChild(imageElem);
        });


    // board_blob_snaps.forEach(blob => {
    //         var imageElem = document.createElement("img");
    //         imageElem.height=100;
    //         imageElem.width=100;
    //         imageElem.src = URL.createObjectURL(blob);
    //         snapPreviewContElem.appendChild(imageElem);
    // });
}
function saveGif(){
    encoder.finish();
    // var binary_gif = encoder.stream().getData() //notice this is different from the as3gif package!
    // var data_url = 'data:image/gif;base64,'+encode64(binary_gif);
    encoder.download("download.gif");
}



function getCanvasImage() {
    // Create a temporary canvas for resizing
    var tempCanvas = document.createElement('canvas');
    tempCanvas.width = 200;
    tempCanvas.height = 200;
    var tempCtx = tempCanvas.getContext('2d');

    // Draw the content from the original canvas to the temporary canvas with resizing
    tempCtx.drawImage(canvas, 0, 0, 200, 200);

    // Convert the temporary canvas to a data URL
    var dataURL = tempCanvas.toDataURL('image/png');

    //document.body.removeChild(tempCanvas);

    return dataURL;
    // // Create a link element
    // var downloadLink = document.createElement('a');

    // // Set the href attribute with the data URL
    // downloadLink.href = dataURL;

    // // Set the download attribute with the desired file name
    // downloadLink.download = 'resized_image.png';

    // // Append the link to the body
    // document.body.appendChild(downloadLink);

    // // Programmatically click the link to trigger the download
    // downloadLink.click();

    // // Remove the link from the body
    // document.body.removeChild(downloadLink);
}

