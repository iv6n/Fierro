import { readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

const projectRoot = process.env.BENCHMARK_ROOT
  ? pathToFileURL(`${resolve(process.env.BENCHMARK_ROOT)}\\`)
  : new URL("../", import.meta.url);
const workerUrl = new URL("dist/server/index.js", projectRoot);
workerUrl.searchParams.set("benchmark", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

const env = {
  ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
};
const ctx = { waitUntil() {}, passThroughOnException() {} };
const routes = ["/", "/personalizados", "/personalizados/gorras", "/personalizados/aretes", "/personalizados/placas"];
const samples = 15;

async function measureRoute(path) {
  for (let index = 0; index < 2; index += 1) await worker.fetch(new Request(`http://localhost${path}`), env, ctx);
  const durations = [];
  let html = "";
  for (let index = 0; index < samples; index += 1) {
    const start = performance.now();
    const response = await worker.fetch(new Request(`http://localhost${path}`), env, ctx);
    html = await response.text();
    durations.push(performance.now() - start);
  }
  durations.sort((left, right) => left - right);
  const average = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
  return {
    path,
    status: 200,
    htmlBytes: Buffer.byteLength(html),
    averageMs: Number(average.toFixed(2)),
    p50Ms: Number(durations[Math.floor(durations.length * 0.5)].toFixed(2)),
    p95Ms: Number(durations[Math.floor(durations.length * 0.95)].toFixed(2)),
  };
}

const assetFiles = await readdir(new URL("dist/client/assets/", projectRoot));
const assetSizes = Object.fromEntries(await Promise.all(assetFiles.map(async (name) => [name, (await stat(new URL(`dist/client/assets/${name}`, projectRoot))).size])));
const relevantAssets = Object.fromEntries(Object.entries(assetSizes).filter(([name]) => /Fierro|CustomExperience|framework|bwip/.test(name)));

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  samples,
  routes: await Promise.all(routes.map(measureRoute)),
  clientAssetBytes: Object.values(assetSizes).reduce((sum, size) => sum + size, 0),
  relevantClientAssets: relevantAssets,
}, null, 2));
