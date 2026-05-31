CREATE TABLE IF NOT EXISTS daily_bars (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    open DOUBLE PRECISION NOT NULL,
    high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL,
    close DOUBLE PRECISION NOT NULL,
    volume INTEGER NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    ma5 DOUBLE PRECISION,
    ma20 DOUBLE PRECISION,
    ma60 DOUBLE PRECISION,
    ma120 DOUBLE PRECISION
);

CREATE INDEX IF NOT EXISTS idx_daily_bars_code_date ON daily_bars(code, date);

CREATE TABLE IF NOT EXISTS pattern_signals (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    pattern_id VARCHAR(50) NOT NULL,
    pattern_name VARCHAR(50) NOT NULL,
    category VARCHAR(20) NOT NULL,
    direction VARCHAR(10) NOT NULL,
    confidence DOUBLE PRECISION DEFAULT 1.0,
    description VARCHAR(500) NOT NULL,
    backtest JSONB NOT NULL DEFAULT '{}',
    limitations JSONB NOT NULL DEFAULT '[]',
    related_patterns JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_pattern_signals_code_date ON pattern_signals(code, date);
CREATE INDEX IF NOT EXISTS idx_pattern_signals_pattern ON pattern_signals(pattern_id, date);
