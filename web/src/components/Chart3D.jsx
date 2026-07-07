import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { modelColor, shortModel, fmtTokens, fmtUsd } from '../util.js';
import { useI18n } from '../i18n.jsx';

const WORLD_W = 16;
const WORLD_H = 6;
const BAR_DEPTH = 0.9;

function makeLabel(text, cls) {
  const el = document.createElement('div');
  el.className = cls;
  el.textContent = text;
  return new CSS2DObject(el);
}

function clearPlot(group) {
  for (const mat of group.userData.materials || []) mat.dispose();
  for (const g of group.userData.geoms || []) g.dispose();
  group.userData.materials = [];
  group.userData.geoms = [];
  while (group.children.length) group.remove(group.children[0]);
}

function buildPlot(group, geom, rows, models, max, metric) {
  clearPlot(group);
  const fmt = metric === 'cost' ? fmtUsd : fmtTokens;

  const N = rows.length;
  const slot = WORLD_W / N;
  const barW = Math.max(0.14, Math.min(1.1, slot - 0.35));

  const matByModel = new Map();
  models.forEach((m, i) => {
    const c = new THREE.Color(modelColor(m, i));
    const mat = new THREE.MeshStandardMaterial({
      color: c.clone().multiplyScalar(0.32),
      emissive: c,
      emissiveIntensity: 0.8,
      metalness: 0.4,
      roughness: 0.35,
    });
    matByModel.set(m, mat);
    group.userData.materials.push(mat);
  });

  // Ось значений: сетка + подписи
  const gridMat = new THREE.LineBasicMaterial({ color: 0x22e6ff, transparent: true, opacity: 0.18 });
  group.userData.materials.push(gridMat);
  const gridPts = [];
  const TICKS = 4;
  for (let i = 0; i <= TICKS; i++) {
    const y = (i / TICKS) * WORLD_H;
    gridPts.push(-WORLD_W / 2, y, -BAR_DEPTH / 2, WORLD_W / 2, y, -BAR_DEPTH / 2);
    const lbl = makeLabel(fmt((i / TICKS) * max), 'c2d-axis');
    lbl.position.set(-WORLD_W / 2 - 0.95, y, -BAR_DEPTH / 2);
    group.add(lbl);
  }
  const gridGeom = new THREE.BufferGeometry();
  gridGeom.setAttribute('position', new THREE.Float32BufferAttribute(gridPts, 3));
  group.userData.geoms.push(gridGeom);
  group.add(new THREE.LineSegments(gridGeom, gridMat));

  const step = Math.max(1, Math.ceil(N / 16));
  rows.forEach((r, ci) => {
    const x = -WORLD_W / 2 + slot * (ci + 0.5);
    let y = 0;
    r.parts.forEach((p) => {
      if (p.value <= 0) return;
      const h = (p.value / max) * WORLD_H;
      const mesh = new THREE.Mesh(geom, matByModel.get(p.model));
      mesh.scale.set(barW, h, BAR_DEPTH);
      mesh.position.set(x, y + h / 2, 0);
      mesh.userData = { date: r.date, model: p.model, value: p.value, total: r.total };
      group.add(mesh);
      y += h + 0.02;
    });
    if (ci % step === 0 || ci === N - 1) {
      const lbl = makeLabel(r.date.slice(5), 'c2d-date');
      lbl.position.set(x, -0.4, BAR_DEPTH / 2 + 0.1);
      group.add(lbl);
    }
  });
}

export default function Chart3D({ rows, models, max, metric }) {
  const { t } = useI18n();
  const wrapRef = useRef(null);
  const apiRef = useRef(null);
  const [tip, setTip] = useState(null);

  // Инициализация сцены (один раз)
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    // Фиксированный изометрический угол — статично и читаемо.
    camera.position.set(6, 9, 15);
    camera.lookAt(0, 2.2, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x05080f, 1);
    wrap.appendChild(renderer.domElement);

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.left = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    wrap.appendChild(labelRenderer.domElement);

    scene.add(new THREE.AmbientLight(0x8fbfff, 0.65));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(6, 12, 8);
    scene.add(key);
    const rim = new THREE.PointLight(0x22e6ff, 1.1, 60);
    rim.position.set(-9, 6, -2);
    scene.add(rim);

    const grid = new THREE.GridHelper(22, 22, 0x22e6ff, 0x123a4a);
    grid.material.transparent = true;
    grid.material.opacity = 0.28;
    scene.add(grid);

    const geom = new THREE.BoxGeometry(1, 1, 1);
    const plot = new THREE.Group();
    plot.userData.materials = [];
    plot.userData.geoms = [];
    scene.add(plot);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.8, 0.5, 0.14);
    composer.addPass(bloom);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    // Рендер по требованию (статичная сцена — не крутим RAF впустую).
    let queued = false;
    function requestRender() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        composer.render();
        labelRenderer.render(scene, camera);
      });
    }

    function resize() {
      const w = wrap.clientWidth,
        h = wrap.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      bloom.setSize(w, h);
      labelRenderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      requestRender();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    function onMove(e) {
      const r = wrap.getBoundingClientRect();
      pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(plot.children, false).find((h) => h.object.isMesh && h.object.userData.model);
      if (hit) {
        const p = hit.point.clone().project(camera);
        setTip({ left: (p.x * 0.5 + 0.5) * r.width, top: (-p.y * 0.5 + 0.5) * r.height, ...hit.object.userData });
      } else {
        setTip(null);
      }
    }
    function onLeave() {
      setTip(null);
    }
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerleave', onLeave);

    apiRef.current = { plot, geom, requestRender };

    return () => {
      ro.disconnect();
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerleave', onLeave);
      clearPlot(plot);
      geom.dispose();
      grid.geometry.dispose();
      grid.material.dispose();
      composer.dispose?.();
      renderer.dispose();
      renderer.domElement.parentNode?.removeChild(renderer.domElement);
      labelRenderer.domElement.parentNode?.removeChild(labelRenderer.domElement);
      apiRef.current = null;
    };
  }, []);

  // Пересборка при смене данных/метрики
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    setTip(null);
    if (!rows || rows.length === 0) {
      clearPlot(api.plot);
    } else {
      buildPlot(api.plot, api.geom, rows, models, max, metric);
    }
    api.requestRender();
  }, [rows, models, max, metric]);

  const fmt = metric === 'cost' ? fmtUsd : fmtTokens;

  return (
    <div className="chart3d-wrap" ref={wrapRef}>
      {tip && (
        <div className="chart-tip" style={{ left: tip.left, top: tip.top }}>
          <b>{shortModel(tip.model)}</b> · {tip.date}
          <br />
          {fmt(tip.value)} <span className="tip-total">/ {t('chart.day')} {fmt(tip.total)}</span>
        </div>
      )}
    </div>
  );
}
