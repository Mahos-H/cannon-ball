'use client'

import React, { useEffect, useRef, useState } from 'react'

const G = 10.0
const MAX_SPEED = 100.0
const MIN_ANGLE = 0
const MAX_ANGLE = 89

// Scene configuration - designed so ONLY trampoline bounce can hit target
const WORLD_WIDTH_M = 200.0
const WORLD_HEIGHT_M = 120.0

// Cannon at center-right
const CANNON_POS = { x: 80.0, y: 0.0 }

// Target BEHIND cannon (to the left) - impossible to hit directly
const DEFAULT_TARGET = { x: 40.0, y: 40.0, r: 1.0 }

// Floor blocking direct path to target
const FLOOR = { 
  left: 0, 
  right: 60, 
  y: 25.0, 
  thickness: 2.0 
}

// Trampoline at far right edge
const TRAMP = { 
  x: 185.0, 
  speed: 12.0, 
  amplitude: 10.0, 
  centerY: 60.0,
  boostFactor: 1.1
}

const CANNONBALL_R = 1.0

export default function Page() {
  const [speed, setSpeed] = useState('')
  const [angle, setAngle] = useState('')
  const [running, setRunning] = useState(false)
  const [celebrate, setCelebrate] = useState(false)

  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const worldRef = useRef({
    canvasW: 1000,
    canvasH: 600,
    marginPx: 40,
    metersPerPx: 1,
  })

  const launchRef = useRef(null)
  const hitRef = useRef(false)
  const bouncedRef = useRef(false)

  const clampSpeed = (v) => Math.max(0, Math.min(MAX_SPEED, Number(v || 0)))
  const clampAngle = (a) => Math.max(MIN_ANGLE, Math.min(MAX_ANGLE, Number(a || 0)))

  useEffect(() => {
    
    const canvas = canvasRef.current
    if (!canvas) return

    function setupCanvas() {
      const screenW = window.innerWidth
      const screenH = window.innerHeight

      const marginW = screenW * 0.05
      const marginH = screenH * 0.05

      const cssW = screenW - 2 * marginW
      const cssH = screenH - 2 * marginH

      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(cssW * dpr)
      canvas.height = Math.round(cssH * dpr)
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`

      worldRef.current.canvasW = cssW
      worldRef.current.canvasH = cssH

      const coordMargin = Math.min(cssW, cssH) * 0.05
      worldRef.current.marginPx = coordMargin

      const playableWidth = cssW - 2 * coordMargin
      const playableHeight = cssH - 2 * coordMargin
      
      const scaleX = playableWidth / WORLD_WIDTH_M
      const scaleY = playableHeight / WORLD_HEIGHT_M
      
      worldRef.current.metersPerPx = Math.min(scaleX, scaleY)
    }

    setupCanvas()
    window.addEventListener('resize', setupCanvas)
    return () => window.removeEventListener('resize', setupCanvas)
  }, [])

  function mToPx(xMeters, yMeters) {
    const w = worldRef.current
    const xPx = w.marginPx + xMeters * w.metersPerPx
    const yPx = w.canvasH - w.marginPx - yMeters * w.metersPerPx
    return { x: xPx, y: yPx }
  }

  function trampCenterYAt(tSec) {
  const range = WORLD_HEIGHT_M;     // full vertical range (0 → WORLD_HEIGHT_M)
  const speed = 12.0;                // constant speed
  const period = (2 * range) / speed; // time for full up + down cycle
  const dist = (tSec * speed) % (2 * range);

  // go up for first half, then down
  return dist < range ? dist : 2 * range - dist;
  }


  function checkTargetHit(xM, yM) {
    const dx = xM - DEFAULT_TARGET.x
    const dy = yM - DEFAULT_TARGET.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    return dist <= (DEFAULT_TARGET.r + CANNONBALL_R)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1

    function render() {
      const w = worldRef.current
      const nowSec = performance.now() / 1000.0

      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.fillStyle = '#0a1628'
      ctx.fillRect(0, 0, w.canvasW, w.canvasH)

      // Draw grid
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'
      ctx.lineWidth = 1
      
      for (let x = 0; x <= WORLD_WIDTH_M; x += 20) {
        const pos = mToPx(x, 0)
        ctx.beginPath()
        ctx.moveTo(pos.x, w.marginPx)
        ctx.lineTo(pos.x, w.canvasH - w.marginPx)
        ctx.stroke()
      }
      
      for (let y = 0; y <= WORLD_HEIGHT_M; y += 20) {
        const pos = mToPx(0, y)
        ctx.beginPath()
        ctx.moveTo(w.marginPx, pos.y)
        ctx.lineTo(w.canvasW - w.marginPx, pos.y)
        ctx.stroke()
      }

      // Draw axis labels
      ctx.fillStyle = 'rgba(200,210,220,0.4)'
      ctx.font = '9px monospace'
      ctx.textAlign = 'center'
      
      for (let x = 0; x <= WORLD_WIDTH_M; x += 40) {
        const pos = mToPx(x, 0)
        ctx.fillText(`${x}m`, pos.x, w.canvasH - w.marginPx + 14)
      }
      
      ctx.textAlign = 'right'
      for (let y = 0; y <= WORLD_HEIGHT_M; y += 20) {
        const pos = mToPx(0, y)
        ctx.fillText(`${y}m`, w.marginPx - 6, pos.y + 3)
      }

      // Draw floor (blocking direct path)
      const floorLeftPos = mToPx(FLOOR.left, FLOOR.y)
      const floorRightPos = mToPx(FLOOR.right, FLOOR.y)
      const floorHeight = FLOOR.thickness * w.metersPerPx
      
      ctx.fillStyle = '#475569'
      ctx.fillRect(
        floorLeftPos.x,
        floorLeftPos.y - floorHeight / 2,
        floorRightPos.x - floorLeftPos.x,
        floorHeight
      )

      // Draw cannon
      const cannonPos = mToPx(CANNON_POS.x, CANNON_POS.y)
      ctx.fillStyle = '#8b5cf6'
      ctx.beginPath()
      ctx.arc(cannonPos.x, cannonPos.y, 18, 0, Math.PI * 2)
      ctx.fill()

      // Cannon barrel
      const rad = (angle * Math.PI) / 180
      ctx.strokeStyle = '#f97316'
      ctx.lineWidth = 12
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(cannonPos.x, cannonPos.y)
      ctx.lineTo(
        cannonPos.x + Math.cos(rad) * 55,
        cannonPos.y - Math.sin(rad) * 55
      )
      ctx.stroke()

      // Draw target (behind cannon)
      const targetPos = mToPx(DEFAULT_TARGET.x, DEFAULT_TARGET.y)
      ctx.fillStyle = '#ef4444'
      ctx.beginPath()
      ctx.arc(targetPos.x, targetPos.y, DEFAULT_TARGET.r * w.metersPerPx, 0, Math.PI * 2)
      ctx.fill()
      
      // Target outline
      ctx.strokeStyle = '#fca5a5'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(targetPos.x, targetPos.y, (DEFAULT_TARGET.r + 1) * w.metersPerPx, 0, Math.PI * 2)
      ctx.stroke()

      // Draw trampoline (vertical mirror)
      const trampY = trampCenterYAt(nowSec)
      const trampPos = mToPx(TRAMP.x, trampY)
      const trampHeight = 50
      
      ctx.fillStyle = '#22c55e'
      ctx.fillRect(
        trampPos.x + 12,
        trampPos.y - trampHeight / 2,
        5,
        trampHeight
      )
      
 

      // Draw cannonball
      const launch = launchRef.current
      if (launch) {
        const tSince = nowSec - launch.t0
        const xM = launch.vx * tSince + launch.x0
        const yM = launch.vy * tSince - 0.5 * G * tSince * tSince + launch.y0

        const ballPos = mToPx(xM, yM)

        
        // Main ball
        ctx.fillStyle = bouncedRef.current ? '#a78bfa' : '#fbbf24'
        ctx.beginPath()
        ctx.arc(ballPos.x, ballPos.y, CANNONBALL_R * w.metersPerPx, 0, Math.PI * 2)
        ctx.fill()

        const vyNow = launch.vy - G * tSince
        const vxNow = launch.vx

        // Floor collision
        if ((xM-CANNONBALL_R) >= FLOOR.left && (xM+CANNONBALL_R) <= FLOOR.right) {
          const floorTop = FLOOR.y + FLOOR.thickness / 2
          const floorBottom = FLOOR.y - FLOOR.thickness / 2

          if ((yM-CANNONBALL_R) <= floorTop && (yM+CANNONBALL_R) >= floorBottom) {
            if ((vyNow < 0 && yM <= FLOOR.y) || (vyNow > 0 && yM >= FLOOR.y)) {
              launchRef.current = {
                vx: vxNow ,
                vy: -vyNow * 0.9,
                t0: nowSec,
                x0: xM,
                y0: vyNow < 0 ? floorTop + CANNONBALL_R : floorBottom - CANNONBALL_R
              }
            }
          }
        }

        // Trampoline collision - perfect mirror reflection with boost
        const distToTrampX = (xM-CANNONBALL_R) - TRAMP.x
        const trampHalfH = (trampHeight / w.metersPerPx) / 2
        
        if (distToTrampX >= -1.5 && distToTrampX <= 1.5 && 
            Math.abs(yM - trampY) < trampHalfH && 
            vxNow > 0 && !bouncedRef.current) {
          
          // Log collision velocities (vy vx) and collision point (x,y) in meters
          

          // Mirror reflection: vx becomes -vx with boost
          bouncedRef.current = true
          launchRef.current = {
            vx: -vxNow * TRAMP.boostFactor,
            vy: vyNow,
            t0: nowSec,
            x0: TRAMP.x ,
            y0: yM
          }
          console.log(
            `Trampoline collision — velocities (vy vx): ${vyNow.toFixed(3)} ${vxNow.toFixed(3)}; ` +
            `collision point (x,y): (${xM.toFixed(3)}m, ${yM.toFixed(3)}m)`
          )
        }
        
        // Ground collision
        if (yM <= CANNONBALL_R && vyNow < 0) {
          launchRef.current = {
            vx: vxNow ,
            vy: -vyNow ,
            t0: nowSec,
            x0: xM,
            y0: CANNONBALL_R
          }
        }

        // Target hit - only valid if bounced
        if (checkTargetHit(xM, yM) && !hitRef.current) {
          if (bouncedRef.current) {
            hitRef.current = true
            setCelebrate(true)
            setRunning(false)
            launchRef.current = null
            setTimeout(() => {
              setCelebrate(false)
              hitRef.current = false
            }, 1000)
          }
        }

        // Out of bounds
        if (yM < -5 || xM > WORLD_WIDTH_M + 20 || xM < -20 || yM > WORLD_HEIGHT_M + 20) {
          setRunning(false)
          launchRef.current = null
        }
      }

      ctx.restore()
      rafRef.current = requestAnimationFrame(render)
    }

    rafRef.current = requestAnimationFrame(render)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [angle, speed])

  function fire() {
    const v = clampSpeed(parseFloat(speed) || 0)
    const a = clampAngle(parseFloat(angle) || 0)
    
    const rad = (a * Math.PI) / 180.0
    const vx = v * Math.cos(rad)
    const vy = v * Math.sin(rad)

    // Log initial velocities in vy vx form
    console.log(`Initial velocities (vy vx): ${vy.toFixed(3)} ${vx.toFixed(3)}`)
    
    launchRef.current = {
      vx,
      vy,
      t0: performance.now() / 1000.0,
      x0: CANNON_POS.x,
      y0: CANNON_POS.y
    }
    
    setRunning(true)
    hitRef.current = false
    bouncedRef.current = false
    setCelebrate(false)
  }

  function reset() {
    setRunning(false)
    launchRef.current = null
    hitRef.current = false
    bouncedRef.current = false
    setCelebrate(false)
  }
const [imgSrc1, setImgSrc1] = useState(null);
const [imgSrc2, setImgSrc2] = useState(null);
useEffect(() => {
  fetch('/flag.zip')
    .then(r => r.text())
    .then(txt => {
      const s = txt.trim();
      if (s.startsWith('data:')) setImgSrc1(s);
      else {
        console.warn('flag.zip did not contain a data: URI');
      }
    })
    .catch(e => console.error('failed to load flag.zip', e));
}, []);
useEffect(() => {
  fetch('/target_hit.mp3')
    .then(r => r.text())
    .then(txt => {
      const s = txt.trim();
      if (s.startsWith('data:')) setImgSrc1(s);
      else {
      }
    })
    .catch(e => console.error('failed to load flag.zip', e));
}, []);
useEffect(() => {
  fetch('/secrets.txt')
    .then(r => r.text())
    .then(txt => {
      const s = txt.trim();
      if (s.startsWith('data:')) setImgSrc2(s);
      else {
        console.warn('secrets.txt did not contain a data: URI');
      }
    })
    .catch(e => console.error('failed to load secrets.txt', e));
}, []);
  return (
    
    <div style={{
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      position: 'fixed',
      top: 0,
      left: 0,
      background: '#0a1628',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      margin: 0,
      padding: 0
    }}>
{(() => {
  return (
 
      <img
        id="f00lish-stuff"
        src={imgSrc1 || undefined}
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          width: '100px',
          height: '100px',
          zIndex: 9,
          pointerEvents: 'none',
          userSelect: 'none',
          opacity: 0.01
        }}
      />

  )
})()}

      <div style={{
        position: 'absolute',
        top: 20,
        right: 20,
        background: 'rgba(15,23,42,0.95)',
        padding: '20px',
        borderRadius: '12px',
        color: '#e2e8f0',
        fontSize: '14px',
        zIndex: 10,
        width: '280px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
      }}>
        <div style={{ fontWeight: 700, marginBottom: 16, fontSize: '16px' }}>
          Cannon Controls
        </div>
        
        <label style={{ display: 'block', marginBottom: 12 }}>
          <div style={{ marginBottom: 6 }}>Speed (m/s):</div>
          <input
            type="text"
            value={speed}
            onChange={(e) => {
              const val = e.target.value
              if (val === '' || /^\d*\.?\d*$/.test(val)) {
                if (parseInt(val) < 101 || val==''){
                  setSpeed(val)
                }
              }
            }}
            placeholder="0"
            style={{ 
              width: '100%', 
              padding: '8px', 
              borderRadius: '4px', 
              border: '1px solid #475569',
              background: '#1e293b',
              color: '#e2e8f0',
              fontSize: '14px'
            }}
          />
        </label>
        
        <label style={{ display: 'block', marginBottom: 16 }}>
          <div style={{ marginBottom: 6 }}>Angle (degrees):</div>
          <input
            type="text"
            value={angle}
            onChange={(e) => {
              const val = e.target.value
              if (val === '' || /^\d*\.?\d*$/.test(val)) {
                if (parseInt(val) < 90 || val==''){
                  setAngle(val)
                }
              }
            }}
            placeholder="0"
            style={{ 
              width: '100%', 
              padding: '8px', 
              borderRadius: '4px', 
              border: '1px solid #475569',
              background: '#1e293b',
              color: '#e2e8f0',
              fontSize: '14px'
            }}
          />
        </label>
        
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={fire}
            disabled={running}
            style={{
              flex: 1,
              padding: '10px',
              background: running ? '#475569' : '#8b5cf6',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: running ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '14px'
            }}
          >
            Fire
          </button>
          <button
            onClick={reset}
            style={{
              flex: 1,
              padding: '10px',
              background: '#64748b',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px'
            }}
          >
            Reset
          </button>
        </div>
        
        <div style={{
          marginTop: 14,
          paddingTop: 14,
          borderTop: '1px solid rgba(255,255,255,0.1)',
          fontSize: '11px',
          color: '#94a3b8',
          lineHeight: '1.6'
        }}>
          <div style={{marginBottom: 6, color: '#fbbf24', fontWeight: 600}}>
            Challenge: Hit target BEHIND cannon!
          </div>
          <div>Cannon: ({CANNON_POS.x}m, {CANNON_POS.y}m)</div>
          <div>Target: ({DEFAULT_TARGET.x}m, {DEFAULT_TARGET.y}m)</div>
          <div>Trampoline: x={TRAMP.x}m</div>
          <div style={{marginTop: 8, color: '#10b981', fontSize: '10px'}}>
            Max angle = 89° and Max speed = 100 m/s Trampoline moves with constant 12 m/s
          </div>
          <div style={{marginTop: 6, color: '#64748b', fontSize: '10px'}}>
            After collision with trampoline Vx increases by 10%. Acceleration due to gravity is 10 m/s^2.
          </div>
        </div>
      </div>

      {celebrate && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(34, 197, 94, 0.95)',
          padding: '30px 60px',
          borderRadius: '16px',
          color: '#fff',
          fontSize: '28px',
          fontWeight: 700,
          zIndex: 20,
          boxShadow: '0 8px 16px rgba(0,0,0,0.4)'
        }}>
          {(() => {
  return (
 
      <img
        id="secret-stuff"
        src={imgSrc2 || undefined}
        style={{
          position: 'relative',
          top: 20,
          right: 20,
          width: '120px',
          height: '120px',
          zIndex: 20,
          pointerEvents: 'none',
          userSelect: 'none',
          opacity: 0.2
        }}
      />

  )
})()}
          Nice try man!
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </div>
  )
}
