import kokugoDic from '@/js/sakuin/kokugo.js'
import kanjiDic from '@/js/sakuin/kanji.js'
import onomatDic from '@/js/sakuin/onomat.js'
import kanaProcess from '@/js/kana_helpers.js'

import { useEnv } from './env'

type TSearchMode = 'primary' | 'kokugo' | 'kanji' | 'onomat'

interface ICurrent {
  mode?: TSearchMode,
  query?: string,
  seq?: number,
  page?: number,
}

type TSearchResult = [
  seq: number,
  kanji: string,
  reading: string,
  meaning: string,
  isCommon: boolean,
  isLearned: boolean,
]

const SEARCH_MODES = [
  { id: 'primary', title: '探す' },
  { id: 'kokugo', title: '国語' },
  { id: 'kanji', title: '漢字' },
  { id: 'onomat', title: 'ｵﾉﾏﾄ' },
]

const searchName = (params: ICurrent) => {
  if (['kokugo', 'kanji', 'onomat'].includes(params.mode)) {
    return 'jiten'
  } else if (params.query) {
    return 'sub-search'
  } else {
    return 'index'
  }
}

export const useSearch = defineStore('search', {
  state: () => ({
    query: '', // query value for completed search
    selectedIdx: null,
    results: [] as TSearchResult[], // candidates array (short info)
    current: {
      mode: undefined, // primary, kokugo, kanji, onomat
      query: undefined,
      seq: undefined,
      page: undefined,
    } as ICurrent,
    searchModes: SEARCH_MODES,
  }),

  getters: {
    currentIndex(state) {
      if (!state.current.seq) return -1
      return state.results.findIndex((i) => i[0] === state.current.seq)
    },

    searchPath(state) {
      return {
        name: searchName(state.current),
        params: state.current,
      }
    },
  },

  actions: {
    async search(query: string, mode: TSearchMode, params: { seq?: number, popRoute?: boolean }) {
      switch (mode) {
        case 'kokugo': return this.kokugoSearch(query)
        case 'kanji': return this.kanjiSearch(query)
        case 'onomat': return this.onomatSearch(query)
        default: return await this.normalSearch(query, params?.seq)
      }
    },

    async normalSearch(queryString: string, seq?: number) {
      return new Promise((resolve, reject) => {
        const query = queryString.trim()

        if (!query || query === this.query) return

        $fetch<string>(
          '/api/search',
          { method: 'POST', body: { query } },
        ).then(resp => {
          this.selectedIdx = null
          this.results = JSON.parse(resp) as TSearchResult[]
          this.query = query

          this.current = {
            mode: 'primary',
            query: query,
            seq:   seq || this.results[0][0]
          }

          useEnv().setActivityGroup('search')
          resolve({ name: 'sub-search', params: { query, seq } })
        }).catch(error => reject(error))
      })
    },

    kokugoSearch(query: string) {
      return new Promise(resolve => {
        const w = kanaProcess(query)
        const wp = kokugoDic.findIndex((i) => i >= w)
        if (wp !== -1) {
          this.current = { mode: 'kokugo', page: wp + 1, query }
          useEnv().setActivityGroup('kokugo')

          resolve({ name: 'jiten', params: { mode: 'kokugo', query } })
        }
      })
    },

    kanjiSearch(query: string) {
      return new Promise(resolve => {
        const result = kanjiDic.find((i) => new RegExp(query).test(i))
        const page = result ? Number.parseInt(result.split(' ')[0]) : null
        if (page) {
          this.current = { mode: 'kanji', page, query }
          useEnv().setActivityGroup('kanji')

          resolve({ name: 'jiten', params: { mode: 'kanji', query } })
        }
      })
    },

    onomatSearch(query: string) {
      return new Promise(resolve => {
        const w = kanaProcess(query)
        const wp = onomatDic.findIndex((i) => i >= w)
        if (wp !== -1) {
          this.current = { mode: 'onomat', page: wp + 1, query }
          useEnv().setActivityGroup('onomat')

          resolve({ name: 'jiten', params: { mode: 'onomat', query } })
        }
      })
    },

    selectSeq(seq: number) {
      seq = +seq
      const idx = this.results.findIndex((i) => i[0] === seq)
      this.setIndex(idx === -1 ? 0 : idx)
    },

    setIndex(idx: number) {
      const sel = this.results[idx]
      if (sel) {
        this.current = {
          mode: 'primary',
          // query: sel[1],
          query: this.query,
          seq: sel[0],
        }
      }
    },

    updateCurrent(newVal: ICurrent) {
      this.current = { ...this.current, ...newVal }
    },
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSearch, import.meta.hot))
}
