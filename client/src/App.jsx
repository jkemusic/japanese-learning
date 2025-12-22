import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Search, Bookmark, Trash2, BookOpen, Volume2, Sparkles, History, Home, ArrowRightLeft, Cloud, CloudOff } from 'lucide-react';

const API_URL = '/api';

function App() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savedWords, setSavedWords] = useState([]);
  const [error, setError] = useState(null);
  const [searchMode, setSearchMode] = useState('word'); // 'word' or 'grammar'
  const [filterLevel, setFilterLevel] = useState('All'); // 'All', 'N1', 'N2', 'N3', 'N4', 'N5', 'Uncategorized'
  const [translateDirection, setTranslateDirection] = useState('ja-zh'); // 'zh-ja' or 'ja-zh'
  const [dbStatus, setDbStatus] = useState('unknown'); // 'connected', 'disconnected', 'local'
  const [sortBy, setSortBy] = useState('date'); // 'date' or 'count'
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' or 'asc'
  const [currentPage, setCurrentPage] = useState(1);
  const [selectionPopup, setSelectionPopup] = useState({ show: false, x: 0, y: 0, loading: false, result: null, text: '' });
  const ITEMS_PER_PAGE = 16;
  const searchTimeout = useRef(null);
  const popupRef = useRef(null);

  useEffect(() => {
    checkConnection();
    fetchSavedWords();

    const handleSelection = (e) => {
      // Don't trigger if selecting inside input/textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Don't trigger if clicking inside the popup itself
      if (popupRef.current && popupRef.current.contains(e.target)) return;

      const selection = window.getSelection();
      const text = selection.toString().trim();

      if (text && text.length > 0 && text.length < 20) { // Limit length to avoid accidental paragraph searches
        // Calculate position
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        setSelectionPopup({
          show: true,
          x: rect.left + window.scrollX,
          y: rect.bottom + window.scrollY + 10,
          loading: true,
          result: null,
          text: text
        });

        // Perform Search
        searchSelection(text);
      } else {
        // Only close if clicking outside popup
        if (popupRef.current && !popupRef.current.contains(e.target)) {
           setSelectionPopup(prev => ({ ...prev, show: false }));
        }
      }
    };

    document.addEventListener('mouseup', handleSelection);
    return () => document.removeEventListener('mouseup', handleSelection);
  }, []);

  const searchSelection = async (text) => {
    try {
      const { data } = await axios.get(`${API_URL}/search`, {
        params: { q: text, direction: 'ja-zh' } // Default to ja-zh for reading text
      });
      // Handle array vs object response logic
      let res = Array.isArray(data) ? data[0] : data;
      setSelectionPopup(prev => ({ ...prev, loading: false, result: res }));
    } catch (err) {
      setSelectionPopup(prev => ({ ...prev, loading: false, error: '查無結果' }));
    }
  };

  const checkConnection = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/heartbeat`);
      if (data.dbMode === 'cloud' && data.dbStatus === 'connected') {
        setDbStatus('connected');
      } else {
        setDbStatus('error');
      }
    } catch (e) {
      setDbStatus('error');
    }
  };

  const fetchSavedWords = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/saved`);
      setSavedWords([...data].reverse());
    } catch (err) {
      console.error('Failed to fetch saved words', err);
      setError(`無法讀取收藏清單: ${err.message}`);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);

    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (value.trim().length > 0 && searchMode === 'word') { // Only suggest for words
      searchTimeout.current = setTimeout(async () => {
        try {
          const { data } = await axios.get(`${API_URL}/suggest`, {
            params: { q: value, direction: translateDirection }
          });
          setSuggestions(data);
          setShowSuggestions(true);
        } catch (err) {
          console.error('Suggestion error', err);
        }

      }, 800);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setShowSuggestions(false);
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const endpoint = searchMode === 'word' ? '/search' : '/grammar';
      const params = searchMode === 'word'
        ? { q: query, direction: translateDirection }
        : { q: query };
      const { data } = await axios.get(`${API_URL}${endpoint}`, { params });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || '找不到資料或發生錯誤');
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (word) => {
    setQuery(word);
    setShowSuggestions(false);
    // Trigger search immediately
    // We need to use the word directly because state update might be async
    // But handleSearch uses 'query' state. 
    // Let's just call the API directly or update state and call a helper.
    // Easiest: Update query and call a version of handleSearch that takes an arg, or just rely on the fact that we setQuery above.
    // Actually, better to just call the search logic directly with the new word.

    // Update query for UI
    setQuery(word);

    // Execute search
    setLoading(true);
    setError(null);
    setResult(null);

    axios.get(`${API_URL}/search?q=${word}`)
      .then(({ data }) => setResult(data))
      .catch(() => setError('找不到單字或發生錯誤'))
      .finally(() => setLoading(false));
  };

  const handleToggleSave = async (targetItem) => {
    const itemToSave = targetItem || result; // Fallback for safety or old calls
    if (!itemToSave) return;
    const isSaved = savedWords.some(w => w.word === itemToSave.word);

    try {
      if (isSaved) {
        await axios.delete(`${API_URL}/saved/${itemToSave.word}`);
      } else {
        await axios.post(`${API_URL}/save`, itemToSave);
      }
      fetchSavedWords();
    } catch (err) {
      console.error('Failed to toggle save', err);
    }
  };

  const handleDelete = async (word, e) => {
    e.stopPropagation();
    try {
      await axios.delete(`${API_URL}/saved/${word}`);
      fetchSavedWords();
    } catch (err) {
      console.error('Failed to delete', err);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '無';
    return new Date(isoString).toLocaleString('zh-TW', { hour12: false });
  };

  const handleHome = () => {
    setQuery('');
    setResult(null);
    setSuggestions([]);
    setShowSuggestions(false);
    setError(null);
    setSearchMode('word');
  };

  // Calculate filtered and paginated items
  // Calculate filtered and paginated items
  const filteredSavedWords = savedWords.filter(item => {
    if (filterLevel === 'All') return true;
    if (filterLevel === 'Uncategorized') return !item.level;
    return item.level && item.level.includes(filterLevel);
  }).sort((a, b) => {
    let diff = 0;
    if (sortBy === 'date') {
      // Assuming savedAt exists. If not, use implicit index logic (but array is pre-sorted by server). 
      // Server returns latest first (DESC).
      // So if sortOrder is DESC, we keep it. If ASC, we reverse.
      const dateA = a.savedAt ? new Date(a.savedAt).getTime() : 0;
      const dateB = b.savedAt ? new Date(b.savedAt).getTime() : 0;
      diff = dateA - dateB;
    } else if (sortBy === 'count') {
      const countA = a.searchCount || (a.history ? a.history.count : 0) || 0;
      const countB = b.searchCount || (b.history ? b.history.count : 0) || 0;
      diff = countA - countB;
    }

    return sortOrder === 'asc' ? diff : -diff;
  });

  const totalPages = Math.ceil(filteredSavedWords.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  // Calculate the slice for the current page
  const currentItems = filteredSavedWords.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Reset page if out of bounds
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="app">
      <button
        onClick={handleHome}
        className="btn-icon"
        style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(255,255,255,0.1)', padding: '0.5rem', borderRadius: '50%' }}
        title="回首頁"
      >
        <Home size={24} />
      </button>

      <header style={{ textAlign: 'center', marginBottom: '3rem', cursor: 'pointer' }} onClick={handleHome}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '0.5rem' }}>
          <span style={{ color: 'var(--primary)' }}>JP</span> Learner
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>日語學習助手</p>
      </header>

      <div style={{ position: 'relative', maxWidth: '600px', margin: '0 auto 2rem' }}>
        <form onSubmit={handleSearch} className="input-group">
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', justifyContent: 'center' }}>
            <button
              type="button"
              className={`btn ${searchMode === 'word' ? 'btn-primary' : 'glass-panel'}`}
              onClick={() => { setSearchMode('word'); setQuery(''); setResult(null); }}
              style={{ borderRadius: '20px', padding: '0.5rem 1.5rem', color: 'white' }}
            >
              單字搜尋
            </button>
            <button
              type="button"
              className={`btn ${searchMode === 'grammar' ? 'btn-primary' : 'glass-panel'}`}
              onClick={() => { setSearchMode('grammar'); setQuery(''); setResult(null); }}
              style={{ borderRadius: '20px', padding: '0.5rem 1.5rem', color: 'white' }}
            >
              文法查詢 (AI)
            </button>
          </div>

          <div className="search-container">
            <input
              type="text"
              className="search-input"
              placeholder={searchMode === 'word' ? (
                translateDirection === 'zh-ja' ? "輸入中文查日文..." : "輸入日文查中文..."
              ) : "輸入文法 (例如: ほど～ない)..."}
              value={query}
              onChange={handleInputChange}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            />
            {searchMode === 'word' && (
              <button
                type="button"
                className="btn"
                onClick={() => setTranslateDirection(prev => prev === 'zh-ja' ? 'ja-zh' : 'zh-ja')}
                style={{
                  borderRadius: 0,
                  padding: '0 1rem',
                  background: 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.85rem',
                  whiteSpace: 'nowrap',
                  color: 'white'
                }}
                title="切換翻譯方向"
              >
                <ArrowRightLeft size={16} />
                {translateDirection === 'zh-ja' ? '中→日' : '日→中'}
              </button>
            )}
            <button type="submit" className="btn btn-primary" style={{ borderRadius: 0, padding: '0 1.5rem' }}>
              <Search size={20} />
            </button>
          </div>
        </form>

        {showSuggestions && suggestions.length > 0 && (
          <div className="glass-panel" style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 10,
            marginTop: '0.5rem',
            padding: '0.5rem',
            maxHeight: '300px',
            overflowY: 'auto'
          }}>
            {suggestions.map((s, idx) => (
              <div
                key={idx}
                onClick={() => handleSuggestionClick(s.word)}
                style={{
                  padding: '0.75rem 1rem',
                  cursor: 'pointer',
                  borderRadius: '0.5rem',
                  transition: 'background 0.2s',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div>
                  <span style={{ fontWeight: 'bold', marginRight: '0.5rem' }}>{s.word}</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{s.reading}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '40%' }} className="truncate">
                  {s.meaning}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div className="loading">
          <p>搜尋中...</p>
        </div>
      )}

      {error && (
        <div className="glass-panel card" style={{ textAlign: 'center', color: '#ef4444' }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Handle Word Results (Array) */}
          {searchMode === 'word' && Array.isArray(result) ? (
            result.map((item, index) => (
              <div key={index} className="glass-panel card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 className="word-title">{item.word}</h2>
                    <div className="reading">{item.reading}</div>
                  </div>
                  <button 
                    className="btn btn-icon" 
                    onClick={() => handleToggleSave(item)} 
                    title={savedWords.find(w => w.word === item.word) ? "取消收藏" : "收藏"}
                  >
                    <Bookmark size={24} fill={savedWords.find(w => w.word === item.word) ? "currentColor" : "none"} />
                  </button>
                </div>

                <div className="badges">
                  {item.accent && <span className="badge badge-accent">重音: {item.accent}</span>}
                  {item.part && <span className="badge badge-part">{item.part}</span>}
                  {item.level && (
                    <span className={`badge ${item.level.includes('N1') ? 'badge-n1' :
                      item.level.includes('N2') ? 'badge-n2' :
                        item.level.includes('N3') ? 'badge-n3' :
                          item.level.includes('N4') ? 'badge-n4' :
                            item.level.includes('N5') ? 'badge-n5' :
                              'badge-level'
                      }`}>
                      {item.level}
                    </span>
                  )}
                </div>

                {item.history && (
                  <div style={{ display: 'flex', gap: '1rem', margin: '1rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <History size={14} />
                      查詢次數: <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{item.history.count}</span>
                    </div>
                    <div style={{ borderLeft: '1px solid var(--glass-border)' }}></div>
                    <div>
                      上次查詢: {item.history.lastSearched ? formatDate(item.history.lastSearched) : '第一次查詢'}
                    </div>
                  </div>
                )}

                <div className="meaning">
                  <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    中文意思
                    {item.translatedMeaning && <span title="由 AI 翻譯" style={{ fontSize: '0.8rem', background: 'var(--accent)', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Sparkles size={12} /> AI 翻譯</span>}
                  </h3>
                  <p>{item.translatedMeaning || item.meaning}</p>
                  {item.translatedMeaning && item.originalMeaning && (
                    <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                      字典原文：{item.originalMeaning}
                    </p>
                  )}
                </div>

                {item.examples && item.examples.length > 0 && (
                  <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--glass-border)' }}>
                    <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      例句
                      {item.isLLM && <span title="由 AI 生成" style={{ fontSize: '0.8rem', background: 'var(--accent)', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Sparkles size={12} /> AI 生成</span>}
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {item.examples.map((ex, idx) => (
                        <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem' }}>
                          <div style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>{ex.jap}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{ex.cht}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            // Handle Grammar (Single Object) or fallback
             <div className="glass-panel card">
            {searchMode === 'grammar' && !Array.isArray(result) ? (
              <>
                <div style={{ marginBottom: '1.5rem' }}>
                  <h2 className="word-title" style={{ fontSize: '2rem' }}>{result.grammar}</h2>
                  <div style={{ display: 'inline-block', background: 'var(--accent)', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                    <Sparkles size={12} style={{ marginRight: '4px' }} />
                    AI 文法解析
                  </div>
                </div>

                <div className="meaning" style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>中文意思</h3>
                  <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{result.meaning}</p>
                </div>

                <div className="usage" style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>用法解說</h3>
                  <p style={{ lineHeight: '1.6' }}>{result.usage}</p>
                </div>

                {result.examples && result.examples.length > 0 && (
                  <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--glass-border)' }}>
                    <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                      例句
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {result.examples.map((ex, idx) => (
                        <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem' }}>
                          <div style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>{ex.jap}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{ex.cht}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : null}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: '4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <BookOpen size={20} />
            收藏單字
          </h3>
          {dbStatus === 'connected' && (
            <div title="雲端同步已開啟" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
              <Cloud size={14} />
              <span>已同步</span>
            </div>
          )}
          {dbStatus === 'local' && (
             <div title="僅本機儲存" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
              <CloudOff size={14} />
              <span>Local</span>
            </div>
          )}
           {dbStatus === 'error' && (
             <div title="連線錯誤" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
              <CloudOff size={14} />
              <span>連線錯誤</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {['All', 'N5', 'N4', 'N3', 'N2', 'N1', 'Uncategorized'].map(level => {
              const count = level === 'All'
                ? savedWords.length
                : level === 'Uncategorized'
                  ? savedWords.filter(w => !w.level).length
                  : savedWords.filter(w => w.level && w.level.includes(level)).length;

              return (
                <button
                  key={level}
                  className={`btn ${filterLevel === level ? 'btn-primary' : 'glass-panel'}`}
                  style={{ padding: '0.25rem 0.75rem', fontSize: '0.9rem', borderRadius: '15px', color: 'white' }}
                  onClick={() => { setFilterLevel(level); setCurrentPage(1); }}
                >
                  {level === 'All' ? '全部' : level === 'Uncategorized' ? '未分類' : level} <span style={{ opacity: 0.7, fontSize: '0.8em', marginLeft: '2px' }}>({count})</span>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>排序:</span>
            <button 
              className={`btn ${sortBy === 'date' ? 'btn-primary' : 'glass-panel'}`}
              style={{ padding: '0.2rem 0.6rem', fontSize: '0.85rem', borderRadius: '8px', color: 'white', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              onClick={() => {
                if (sortBy === 'date') setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
                else { setSortBy('date'); setSortOrder('desc'); }
              }}
            >
              時間
              {sortBy === 'date' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
            <button 
              className={`btn ${sortBy === 'count' ? 'btn-primary' : 'glass-panel'}`}
              style={{ padding: '0.2rem 0.6rem', fontSize: '0.85rem', borderRadius: '8px', color: 'white', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              onClick={() => {
                if (sortBy === 'count') setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
                else { setSortBy('count'); setSortOrder('desc'); }
              }}
            >
              熱門
              {sortBy === 'count' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
          </div>
        </div>

        <div className="saved-list">
          {currentItems.map((item) => (
            <div
              key={item.word}
              className="glass-panel saved-item"
              onClick={() => { 
                setQuery(item.word); 
                // Normalize history data structure to match search result format
                const normalizedItem = {
                  ...item,
                  history: {
                    count: item.searchCount || 0,
                    lastSearched: item.lastSearched
                  }
                };
                setResult([normalizedItem]); 
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>{item.word}</span>
                  {item.level ? (
                    <span className={`badge ${item.level.includes('N1') ? 'badge-n1' :
                      item.level.includes('N2') ? 'badge-n2' :
                        item.level.includes('N3') ? 'badge-n3' :
                          item.level.includes('N4') ? 'badge-n4' :
                            item.level.includes('N5') ? 'badge-n5' :
                              'badge-level'
                      }`} style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}>
                      {item.level}
                    </span>
                  ) : (
                    <span className="badge badge-level" style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', background: 'rgba(255,255,255,0.1)' }}>
                      未分類
                    </span>
                  )}
                </div>
                <button className="btn-icon" onClick={(e) => handleDelete(item.word, e)}>
                  <Trash2 size={16} />
                </button>
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{item.reading}</div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }} className="truncate">{item.meaning}</div>
            </div>
          ))}
          
          {filteredSavedWords.length === 0 && (
            <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>尚無收藏單字</p>
          )}
        </div>

        {/* Pagination Controls - Moved Outside saved-list */}
        {filteredSavedWords.length > 0 && (
          <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '2rem', gap: '1rem' }}>
            <button 
              className="btn glass-panel" 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              style={{ padding: '0.5rem 1rem', color: 'white', opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'default' : 'pointer' }}
            >
              上一頁
            </button>
            <span style={{ color: 'white', fontWeight: 'bold' }}>
              {currentPage} / {totalPages || 1}
            </span>
            <button 
              className="btn glass-panel" 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              style={{ padding: '0.5rem 1rem', color: 'white', opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'default' : 'pointer' }}
            >
              下一頁
            </button>
          </div>
        )}
      </div>

      {/* Selection Popup */}
      {selectionPopup.show && (
        <div 
          ref={popupRef}
          className="glass-panel"
          style={{
            position: 'absolute',
            top: selectionPopup.y,
            left: Math.min(selectionPopup.x, window.innerWidth - 320), // Prevent overflow right
            width: '300px',
            zIndex: 1000,
            padding: '1rem',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
             <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>快速查詢</span>
             <button onClick={() => setSelectionPopup(prev => ({...prev, show: false}))} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>✕</button>
          </div>
          
          {selectionPopup.loading ? (
             <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>
               <Sparkles className="spin" size={20} style={{ marginBottom: '0.5rem' }} />
               <p>搜尋 "{selectionPopup.text}" 中...</p>
             </div>
          ) : selectionPopup.result ? (
            <div>
               <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '0.2rem' }}>{selectionPopup.result.word}</div>
               <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{selectionPopup.result.reading}</div>
               
               <div style={{ marginBottom: '0.5rem' }}>
                 {selectionPopup.result.accent && <span className="badge badge-accent" style={{ fontSize: '0.7rem', marginRight: '0.25rem' }}>{selectionPopup.result.accent}</span>}
                 {selectionPopup.result.level && (
                   <span className={`badge ${selectionPopup.result.level.includes('N1') ? 'badge-n1' :
                     selectionPopup.result.level.includes('N2') ? 'badge-n2' :
                       selectionPopup.result.level.includes('N3') ? 'badge-n3' :
                         selectionPopup.result.level.includes('N4') ? 'badge-n4' :
                           selectionPopup.result.level.includes('N5') ? 'badge-n5' :
                             'badge-level'
                     }`} style={{ fontSize: '0.7rem' }}>
                     {selectionPopup.result.level}
                   </span>
                 )}
               </div>

               <div style={{ fontSize: '0.95rem', lineHeight: '1.4' }}>
                 {selectionPopup.result.translatedMeaning || selectionPopup.result.meaning}
               </div>
               
               <button 
                  className="btn btn-primary" 
                  style={{ width: '100%', marginTop: '1rem', padding: '0.4rem', fontSize: '0.9rem' }}
                  onClick={() => {
                     setQuery(selectionPopup.result.word);
                     setResult(Array.isArray(selectionPopup.result) ? selectionPopup.result : [selectionPopup.result]);
                     setSelectionPopup(prev => ({...prev, show: false}));
                     window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
               >
                 查看完整詳情
               </button>
            </div>
          ) : (
             <div style={{ textAlign: 'center', padding: '1rem', color: '#ef4444' }}>
               找不到 "{selectionPopup.text}" 的結果
             </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
