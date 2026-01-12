import sqlite3

conn = sqlite3.connect('db.sqlite3')
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
print('tables:', [r[0] for r in cur.fetchall()])
try:
    cur.execute("SELECT app,name FROM django_migrations ORDER BY app,name")
    print('migrations:', cur.fetchall())
except Exception as e:
    print('could not read django_migrations:', e)

conn.close()
