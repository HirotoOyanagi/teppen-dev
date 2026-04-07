import { Asset } from 'expo-asset'
import * as FileSystem from 'expo-file-system/legacy'

const CARD_CSV_MODULE = require('../../public/新カードCore - カードデータのスプレッドシート化.csv')

const HERO_MODEL_MODULES: Record<string, number> = {
  '/images/heroes/1_blue-mage.glb': require('../../public/images/heroes/1_blue-mage.glb'),
  '/images/heroes/2_golden-swordsman.glb': require('../../public/images/heroes/2_golden-swordsman.glb'),
  '/images/heroes/3_dark-hero.glb': require('../../public/images/heroes/3_dark-hero.glb'),
  '/images/heroes/4_green-fairy.glb': require('../../public/images/heroes/4_green-fairy.glb'),
  '/images/heroes/5_dark-mage.glb': require('../../public/images/heroes/5_dark-mage.glb'),
  '/images/heroes/6_dark-rogue.glb': require('../../public/images/heroes/6_dark-rogue.glb'),
  '/images/heroes/7_golden-knight.glb': require('../../public/images/heroes/7_golden-knight.glb'),
  '/images/heroes/8_red-berserker.glb': require('../../public/images/heroes/8_red-berserker.glb'),
  '/images/heroes/G6OIGphaAtHqgm78zgypd_model.glb': require('../../public/images/heroes/G6OIGphaAtHqgm78zgypd_model.glb'),
}

async function resolveBundledAssetUri(moduleId: number): Promise<string> {
  const [asset] = await Asset.loadAsync(moduleId)
  const uri = asset.localUri ?? asset.uri

  if (!uri) {
    throw new Error('ローカルアセットのURI解決に失敗しました')
  }

  return uri
}

export async function loadBundledCardCsvText(): Promise<string> {
  const uri = await resolveBundledAssetUri(CARD_CSV_MODULE)
  return FileSystem.readAsStringAsync(uri)
}

export async function loadBundledHeroModelUri(modelUrl?: string): Promise<string | null> {
  if (!modelUrl) {
    return null
  }

  const moduleId = HERO_MODEL_MODULES[modelUrl]
  if (!moduleId) {
    return null
  }

  return resolveBundledAssetUri(moduleId)
}
