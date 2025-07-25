import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useStateTogether } from 'react-together'
import GameControls from './GameControls'

const COLS = 10
const ROWS = 20
const BLOCK_SIZE = 20

const COLORS = [null, '#FF0D72', '#0DC2FF', '#0DFF72', '#F538FF', '#FF8E0D', '#FFE138', '#3877FF', '#6B7280']
const SHAPES = [
  null,
  [[1, 1, 1], [0, 1, 0]],
  [[2, 2, 2, 2]],
  [[0, 3, 3], [3, 3, 0]],
  [[4, 4, 0], [0, 4, 4]],
  [[5, 0, 0], [5, 5, 5]],
  [[0, 0, 6], [6, 6, 6]],
  [[7, 7], [7, 7]],
]

const createEmptyBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(0))

function generateBag() {
  const bag = [1, 2, 3, 4, 5, 6, 7]
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[bag[i], bag[j]] = [bag[j], bag[i]]
  }
  return bag
}

export default function Tetris({ players, sessionId, myAddress, onGameEnd, onRematchOffer, playerStatus, setPlayerStatus, onCloseGame }) {
  const mySymbol = players?.challenger?.address.toLowerCase() === myAddress.toLowerCase() ? 'P1' : 'P2'
  const opponentSymbol = mySymbol === 'P1' ? 'P2' : 'P1'

  const [gameState, setGameState] = useStateTogether(`tetris-gamestate-${sessionId}`, {
    P1: { board: createEmptyBoard(), score: 0, lines: 0, gameOver: false },
    P2: { board: createEmptyBoard(), score: 0, lines: 0, gameOver: false },
    pieceSequences: {
      P1: generateBag(),
      P2: generateBag(),
    },
    playerStates: {
      P1: null,
      P2: null,
    },
    status: 'playing',
    winner: null,
  })

  const [rematchStatus, setRematchStatus] = useStateTogether(`tetris-rematch-${sessionId}`, null)
  const [player, setPlayer] = useState({ pos: { x: 0, y: 0 }, shape: null, collided: false })
  const [pieceIndex, setPieceIndex] = useState(0)
  const [isLocking, setIsLocking] = useState(false)
  const [isDropping, setIsDropping] = useState(false)
  const dropTime = 1000

  const gameAreaRef = useRef(null)
  const opponentAreaRef = useRef(null)
  const requestRef = useRef()
  const lastTimeRef = useRef(0)
  const dropCounterRef = useRef(0)

  const opponentClosed = playerStatus[opponentSymbol] === 'closed'

  useEffect(() => {
    setPlayerStatus(prev => ({ ...prev, [mySymbol]: 'online' }))
  }, [mySymbol, setPlayerStatus])

  useEffect(() => {
    const handleUnload = () => {
      setPlayerStatus(prev => ({ ...prev, [mySymbol]: 'closed' }))
    }
    window.addEventListener('beforeunload', handleUnload)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        handleUnload()
      }
    })
    return () => {
      window.removeEventListener('beforeunload', handleUnload)
      document.removeEventListener('visibilitychange', handleUnload)
    }
  }, [mySymbol, setPlayerStatus])

  const checkCollision = useCallback((playerPiece, board) => {
    if (!playerPiece.shape || !board) return true
    const { shape, pos } = playerPiece
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x] !== 0) {
          const boardY = y + pos.y
          const boardX = x + pos.x
          if (!board[boardY] || board[boardY][boardX] === undefined || board[boardY][boardX] !== 0) {
            return true
          }
        }
      }
    }
    return false
  }, [])

  const resetPlayer = useCallback(() => {
    let sequence = gameState.pieceSequences[mySymbol]
    if (pieceIndex >= sequence.length - 5) {
      const extraBag = generateBag()
      setGameState(prev => ({
        ...prev,
        pieceSequences: {
          ...prev.pieceSequences,
          [mySymbol]: [...prev.pieceSequences[mySymbol], ...extraBag],
        },
      }))
      sequence = [...sequence, ...extraBag]
    }
    const nextShapeIndex = sequence[pieceIndex % sequence.length]
    const newShape = SHAPES[nextShapeIndex]
    if (newShape) {
      setPlayer({
        pos: { x: Math.floor(COLS / 2) - Math.floor(newShape[0].length / 2), y: 0 },
        shape: newShape,
        collided: false,
      })
      setPieceIndex(prev => prev + 1)
    }
  }, [pieceIndex, gameState.pieceSequences, mySymbol, setGameState])

  useEffect(() => {
    resetPlayer()
  }, [])

  useEffect(() => {
    setGameState(prev => ({
      ...prev,
      playerStates: {
        ...prev.playerStates,
        [mySymbol]: { pos: player.pos, shape: player.shape },
      },
    }))
  }, [player, mySymbol, setGameState])

  const movePlayer = useCallback(
    dir => {
      if (isLocking || !player.shape || gameState.status === 'finished' || opponentClosed) return
      const board = gameState[mySymbol].board
      if (!checkCollision({ ...player, pos: { x: player.pos.x + dir, y: player.pos.y } }, board)) {
        setPlayer(prev => ({ ...prev, pos: { x: prev.pos.x + dir, y: prev.pos.y } }))
      }
    },
    [isLocking, player, gameState, mySymbol, opponentClosed, checkCollision]
  )

  const dropPlayer = useCallback(() => {
    if (isLocking || !player.shape || gameState.status === 'finished' || opponentClosed) return
    const board = gameState[mySymbol].board
    if (!checkCollision({ ...player, pos: { x: player.pos.x, y: player.pos.y + 1 } }, board)) {
      setPlayer(prev => ({ ...prev, pos: { x: prev.pos.x, y: prev.pos.y + 1 } }))
    } else {
      if (player.pos.y < 1) {
        setGameState(prev => ({
          ...prev,
          status: 'finished',
          winner: opponentSymbol,
          [mySymbol]: { ...prev[mySymbol], gameOver: true },
        }))
        return
      }
      setPlayer(prev => ({ ...prev, collided: true }))
    }
  }, [isLocking, player, gameState, mySymbol, opponentSymbol, opponentClosed, checkCollision, setGameState])

  const playerRotate = useCallback(
    dir => {
      if (isLocking || !player.shape || gameState.status === 'finished' || opponentClosed) return
      const clonedPlayer = JSON.parse(JSON.stringify(player))
      const rotate = matrix => {
        const transposed = matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]))
        return dir > 0 ? transposed.map(row => row.reverse()) : transposed.reverse()
      }
      clonedPlayer.shape = rotate(clonedPlayer.shape)
      let offset = 1
      const board = gameState[mySymbol].board
      while (checkCollision(clonedPlayer, board)) {
        clonedPlayer.pos.x += offset
        offset = -(offset + (offset > 0 ? 1 : -1))
        if (Math.abs(offset) > clonedPlayer.shape[0].length) return
      }
      setPlayer(clonedPlayer)
    },
    [isLocking, player, gameState, mySymbol, opponentClosed, checkCollision]
  )

  useEffect(() => {
    if (player.collided) {
      const newMyBoard = gameState[mySymbol].board.map(row => [...row])
      player.shape.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value !== 0) newMyBoard[y + player.pos.y][x + player.pos.x] = value
        })
      })

      let linesCleared = 0
      const sweptBoard = newMyBoard.reduce((acc, row) => {
        if (row.every(cell => cell !== 0)) {
          linesCleared++
          acc.unshift(Array(COLS).fill(0))
        } else {
          acc.push(row)
        }
        return acc
      }, [])

      const garbageToSend = Math.max(0, linesCleared - 1)

      setGameState(prev => {
        let newOpponentBoard = prev[opponentSymbol].board
        const isOpponentTopRowClear = prev[opponentSymbol].board[0]?.every(cell => cell === 0)

        if (garbageToSend > 0 && !prev[opponentSymbol].gameOver && isOpponentTopRowClear) {
          newOpponentBoard = prev[opponentSymbol].board.slice()
          for (let i = 0; i < garbageToSend; i++) {
            newOpponentBoard.shift()
            const garbageRow = Array(COLS).fill(8)
            garbageRow[Math.floor(Math.random() * COLS)] = 0
            newOpponentBoard.push(garbageRow)
          }
        }

        return {
          ...prev,
          [mySymbol]: { ...prev[mySymbol], board: sweptBoard, score: prev[mySymbol].score + linesCleared * 10 },
          [opponentSymbol]: { ...prev[opponentSymbol], board: newOpponentBoard },
        }
      })

      if (linesCleared > 0) {
        setIsLocking(true)
        const timeoutId = setTimeout(() => {
          resetPlayer()
          setIsLocking(false)
        }, 300)
        return () => clearTimeout(timeoutId)
      } else {
        resetPlayer()
      }
    }
  }, [player.collided, gameState, mySymbol, opponentSymbol, resetPlayer, setGameState])

  const animate = useCallback(
    (time = 0) => {
      const deltaTime = time - lastTimeRef.current
      lastTimeRef.current = time
      dropCounterRef.current += deltaTime
      if (dropCounterRef.current > dropTime) {
        dropPlayer()
        dropCounterRef.current = 0
      }
      requestRef.current = requestAnimationFrame(animate)
    },
    [dropPlayer, dropTime]
  )

  useEffect(() => {
    if (gameState.status === 'playing' && !gameState[mySymbol].gameOver) {
      requestRef.current = requestAnimationFrame(animate)
    } else {
      cancelAnimationFrame(requestRef.current)
    }
    return () => cancelAnimationFrame(requestRef.current)
  }, [gameState.status, gameState[mySymbol].gameOver, animate])

  useEffect(() => {
    const myCtx = gameAreaRef.current?.getContext('2d')
    const opponentCtx = opponentAreaRef.current?.getContext('2d')
    if (!myCtx || !opponentCtx) return

    const drawBoard = (ctx, board, currentPlayer = null) => {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

      board.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value !== 0) {
            ctx.fillStyle = COLORS[value]
            ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE)
            ctx.strokeStyle = '#000000'
            ctx.lineWidth = 1
            ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE)
          }
        })
      })

      if (currentPlayer?.shape) {
        currentPlayer.shape.forEach((row, y) => {
          row.forEach((value, x) => {
            if (value !== 0) {
              const px = (currentPlayer.pos.x + x) * BLOCK_SIZE
              const py = (currentPlayer.pos.y + y) * BLOCK_SIZE
              ctx.fillStyle = COLORS[value]
              ctx.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE)
              ctx.strokeStyle = '#000000'
              ctx.lineWidth = 1
              ctx.strokeRect(px, py, BLOCK_SIZE, BLOCK_SIZE)
            }
          })
        })
      }
    }

    drawBoard(myCtx, gameState[mySymbol].board, player)
    drawBoard(opponentCtx, gameState[opponentSymbol].board, gameState.playerStates?.[opponentSymbol] || null)
  }, [gameState, player, mySymbol, opponentSymbol])

  const handleRematchRequest = () => {
    if (!players || opponentClosed) return
    setRematchStatus({ by: mySymbol, status: 'pending' })
    onRematchOffer(sessionId, mySymbol, 'pending')
  }

  const handleAcceptRematch = () => {
    setGameState({
      P1: { board: createEmptyBoard(), score: 0, lines: 0, gameOver: false },
      P2: { board: createEmptyBoard(), score: 0, lines: 0, gameOver: false },
      pieceSequences: {
        P1: generateBag(),
        P2: generateBag(),
      },
      playerStates: {
        P1: null,
        P2: null,
      },
      status: 'playing',
      winner: null,
    })
    setPieceIndex(0)
    setRematchStatus(null)
    setPlayerStatus({ P1: 'online', P2: 'online' })
    onRematchOffer(sessionId, mySymbol, 'accepted')
    resetPlayer()
  }

  const handleDeclineRematch = () => {
    onRematchOffer(sessionId, mySymbol, 'declined')
    setRematchStatus(prev => ({ ...prev, status: 'declined' }))
  }

  const handleKeyDown = useCallback(
    e => {
      if (isLocking || gameState.status === 'finished' || opponentClosed) return
      const key = e.key.toLowerCase()
      if (['a', 'arrowleft', 'd', 'arrowright', 's', 'arrowdown', 'w', 'arrowup', 'q', 'e'].includes(key)) {
        e.preventDefault()
      }
      if (key === 'a' || key === 'arrowleft') movePlayer(-1)
      else if (key === 'd' || key === 'arrowright') movePlayer(1)
      else if (key === 's' || key === 'arrowdown') {
        if (!isDropping) {
          setIsDropping(true)
          dropPlayer()
        }
      } else if (key === 'w' || key === 'arrowup') playerRotate(1)
      else if (key === 'q') playerRotate(-1)
      else if (key === 'e') playerRotate(1)
    },
    [isLocking, movePlayer, dropPlayer, playerRotate, gameState.status, opponentClosed, isDropping]
  )

  const handleKeyUp = useCallback(e => {
    const key = e.key.toLowerCase()
    if (key === 's' || key === 'arrowdown') {
      setIsDropping(false)
    }
  }, [])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
    }
  }, [handleKeyDown, handleKeyUp])

  const getPlayerName = symbol => {
    if (!players) return ''
    if (symbol === 'P1') return players.challenger?.username || 'Player 1'
    if (symbol === 'P2') return players.opponent?.username || 'Player 2'
    return ''
  }

  const iAmRematchRequester = rematchStatus && rematchStatus.by === mySymbol
  const iAmRematchReceiver = rematchStatus && rematchStatus.by === opponentSymbol

  const nextShape = SHAPES[gameState.pieceSequences[mySymbol][pieceIndex % gameState.pieceSequences[mySymbol].length]]

  return (
    <div className="flex flex-col items-center max-h-[90vh] overflow-y-auto">
      <div className="flex flex-row justify-center items-start gap-2 w-full px-2">
        <div className="text-center flex flex-col items-center">
          <h3 className="font-bold text-sm sm:text-base flex items-center justify-center gap-2">
            {getPlayerName('P1')} {mySymbol === 'P1' ? '(You)' : ''}
            {mySymbol === 'P1' && nextShape && (
              <div className="inline-block" style={{ width: 64, height: 48 }}>
                {nextShape.map((row, y) => (
                  <div key={y} className="flex justify-center">
                    {row.map((cell, x) => (
                      <div
                        key={x}
                        style={{
                          width: 16,
                          height: 16,
                          backgroundColor: COLORS[cell] || 'transparent',
                          border: cell ? '1px solid #000' : 'none',
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </h3>
          <div
            className={`w-[40vw] max-w-[200px] border-4 ${
              mySymbol === 'P1' ? 'border-blue-500' : 'border-gray-300'
            } rounded-md overflow-hidden`}
          >
            <canvas
              ref={mySymbol === 'P1' ? gameAreaRef : opponentAreaRef}
              width={COLS * BLOCK_SIZE}
              height={ROWS * BLOCK_SIZE}
            />
          </div>
          <p>Score: {gameState.P1.score}</p>
        </div>

        <div className="text-center flex flex-col items-center">
          <h3 className="font-bold text-sm sm:text-base flex items-center justify-center gap-2">
            {getPlayerName('P2')} {mySymbol === 'P2' ? '(You)' : ''}
            {mySymbol === 'P2' && nextShape && (
              <div className="inline-block" style={{ width: 64, height: 48 }}>
                {nextShape.map((row, y) => (
                  <div key={y} className="flex justify-center">
                    {row.map((cell, x) => (
                      <div
                        key={x}
                        style={{
                          width: 16,
                          height: 16,
                          backgroundColor: COLORS[cell] || 'transparent',
                          border: cell ? '1px solid #000' : 'none',
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </h3>
          <div
            className={`w-[40vw] max-w-[200px] border-4 ${
              mySymbol === 'P2' ? 'border-blue-500' : 'border-gray-300'
            } rounded-md overflow-hidden`}
          >
            <canvas
              ref={mySymbol === 'P2' ? gameAreaRef : opponentAreaRef}
              width={COLS * BLOCK_SIZE}
              height={ROWS * BLOCK_SIZE}
            />
          </div>
          <p>Score: {gameState.P2.score}</p>
        </div>
      </div>

      <div className="mt-2 flex gap-2">
        <button
          disabled={rematchStatus && rematchStatus.status === 'pending'}
          onClick={handleRematchRequest}
          className="px-4 py-2 bg-green-600 rounded text-white disabled:bg-gray-500"
        >
          Rematch
        </button>
        {rematchStatus?.status === 'pending' && iAmRematchReceiver && (
          <>
            <button onClick={handleAcceptRematch} className="px-4 py-2 bg-blue-600 rounded text-white">
              Accept
            </button>
            <button onClick={handleDeclineRematch} className="px-4 py-2 bg-red-600 rounded text-white">
              Decline
            </button>
          </>
        )}
        {(rematchStatus?.status === 'declined' || rematchStatus?.status === 'accepted') && (
          <button onClick={onCloseGame} className="px-4 py-2 bg-gray-700 rounded text-white">
            Close
          </button>
        )}
      </div>
    </div>
  )
}
