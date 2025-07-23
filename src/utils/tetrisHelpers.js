export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;

export const EMPTY_BOARD = Array(BOARD_HEIGHT).fill(Array(BOARD_WIDTH).fill(0));

export const TETROMINOS = {
    'I': {
        shape: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
        color: 'cyan'
    },
    'J': {
        shape: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
        color: 'blue'
    },
    'L': {
        shape: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
        color: 'orange'
    },
    'O': {
        shape: [[1, 1], [1, 1]],
        color: 'yellow'
    },
    'S': {
        shape: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
        color: 'green'
    },
    'T': {
        shape: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
        color: 'purple'
    },
    'Z': {
        shape: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
        color: 'red'
    }
};

const TETROMINO_SHAPES = Object.keys(TETROMINOS);

export const getRandomTetromino = () => {
    const randShape = TETROMINO_SHAPES[Math.floor(Math.random() * TETROMINO_SHAPES.length)];
    return {
        shape: TETROMINOS[randShape].shape,
        color: TETROMINOS[randShape].color,
        pos: { x: BOARD_WIDTH / 2 - 2, y: 0 },
        collided: false
    };
};

export const checkCollision = (piece, board, { x: moveX, y: moveY }) => {
    for (let y = 0; y < piece.shape.length; y++) {
        for (let x = 0; x < piece.shape[y].length; x++) {
            if (piece.shape[y][x] !== 0) {
                if (
                    !board[y + piece.pos.y + moveY] ||
                    !board[y + piece.pos.y + moveY][x + piece.pos.x + moveX] ||
                    board[y + piece.pos.y + moveY][x + piece.pos.x + moveX] !== 0
                ) {
                    return true;
                }
            }
        }
    }
    return false;
};

export const rotate = (matrix, dir) => {
    const mtrx = matrix.map(row => [...row]);

    for (let y = 0; y < mtrx.length; y++) {
        for (let x = 0; x < y; x++) {
            [mtrx[x][y], mtrx[y][x]] = [mtrx[y][x], mtrx[x][y]];
        }
    }

    if (dir > 0) return mtrx.map(row => row.reverse());
    return mtrx.reverse();
};


export const createBoard = () => {
    return Array(BOARD_HEIGHT).fill(Array(BOARD_WIDTH).fill(0));
};

export const updateBoard = (prevBoard, player, clearLines = false) => {
    const newBoard = prevBoard.map(row => row.map(cell => (cell === 1 ? 0 : cell))); 
    
    player.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                newBoard[y + player.pos.y][x + player.pos.x] = player.collided ? 2 : 1; 
            }
        });
    });

    if (clearLines) {
        let clearedRows = 0;
        const boardWithClearedLines = newBoard.filter(row => row.every(cell => cell === 2 || cell === 0));
        clearedRows = BOARD_HEIGHT - boardWithClearedLines.length;
        for (let i = 0; i < clearedRows; i++) {
            boardWithClearedLines.unshift(Array(BOARD_WIDTH).fill(0));
        }
        return { board: boardWithClearedLines, clearedRows };
    }

    return { board: newBoard, clearedRows: 0 };
};

export const mergePiece = (board, piece) => {
    const newBoard = board.map(row => [...row]);
    piece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                newBoard[y + piece.pos.y][x + piece.pos.x] = 2; 
            }
        });
    });
    return newBoard;
};
