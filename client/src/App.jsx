import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Search, Bookmark, Trash2, BookOpen, Volume2, Sparkles, History, Home, ArrowRightLeft } from 'lucide-react';

const API_URL = 'http://localhost:3000/api';

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
  const searchTimeout = useRef(null);

  useEffect(() => {
    fetchSavedWords();
  }, []);

  useEffect(() => {
    fetchSavedWords();

    // Heartbeat
    const heartbeatInterval = setInterval(() => {
      axios.get(`${API_URL}/heartbeat`).catch(() => {
        // Ignore errors (server might be down or starting)
      });
    }, 2000); // Send every 2 seconds

    return () => clearInterval(heartbeatInterval);
  }, []);

  const fetchSavedWords = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/saved`);
      setSavedWords(data);
    } catch (err) {
      console.error('Failed to fetch saved words', err);
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
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <BookOpen size={20} />
          收藏單字
        </h3>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
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
                onClick={() => setFilterLevel(level)}
              >
                {level === 'All' ? '全部' : level === 'Uncategorized' ? '未分類' : level} <span style={{ opacity: 0.7, fontSize: '0.8em', marginLeft: '2px' }}>({count})</span>
              </button>
            );
          })}
        </div>

        <div className="saved-list">
          {savedWords
            .filter(item => {
              if (filterLevel === 'All') return true;
              if (filterLevel === 'Uncategorized') return !item.level;
              return item.level && item.level.includes(filterLevel);
            })
            .map((item) => (
              <div
                key={item.word}
                className="glass-panel saved-item"
                onClick={() => { setQuery(item.word); setResult(item); }}
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
          {savedWords.length === 0 && (
            <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>尚無收藏單字</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
