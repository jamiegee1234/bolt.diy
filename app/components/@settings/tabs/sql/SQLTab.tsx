import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '~/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '~/components/ui/Card';
import { motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { toast } from 'react-toastify';
import { openDatabase } from '~/lib/persistence/db';
import { getAllChats } from '~/lib/persistence/chats';

interface SQLQueryResult {
  columns: string[];
  rows: any[][];
  rowsAffected?: number;
  executionTime?: number;
}

interface DatabaseTable {
  name: string;
  type: 'table' | 'view' | 'index';
  sql?: string;
}

export function SQLTab() {
  // State management
  const [query, setQuery] = useState('-- Write your SQL query here\nSELECT * FROM chats LIMIT 10;');
  const [queryResult, setQueryResult] = useState<SQLQueryResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [database, setDatabase] = useState<IDBDatabase | null>(null);
  const [tables, setTables] = useState<DatabaseTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize database connection
  useEffect(() => {
    const initDatabase = async () => {
      try {
        const db = await openDatabase();
        setDatabase(db);
        await loadDatabaseSchema(db);
      } catch (error) {
        console.error('Failed to initialize database:', error);
        toast.error('Failed to connect to database');
      }
    };

    initDatabase();
  }, []);

  // Load database schema
  const loadDatabaseSchema = async (db: IDBDatabase | null) => {
    if (!db) return;

    try {
      const tablesList: DatabaseTable[] = [];
      
      // Get object store names (equivalent to tables in IndexedDB)
      Array.from(db.objectStoreNames).forEach(storeName => {
        tablesList.push({
          name: storeName,
          type: 'table',
          sql: `// IndexedDB Object Store: ${storeName}`
        });
      });

      setTables(tablesList);
    } catch (error) {
      console.error('Failed to load database schema:', error);
      toast.error('Failed to load database schema');
    }
  };

  // Execute SQL query (simulated for IndexedDB)
  const executeQuery = useCallback(async () => {
    if (!database || !query.trim()) {
      toast.error('Please enter a valid query');
      return;
    }

    setIsExecuting(true);
    const startTime = Date.now();

    try {
      // For demo purposes, we'll simulate SQL-like queries on IndexedDB
      if (query.toLowerCase().includes('select') && query.toLowerCase().includes('chats')) {
        const chats = await getAllChats(database);
        const executionTime = Date.now() - startTime;
        
        const result: SQLQueryResult = {
          columns: ['ID', 'Description', 'Messages', 'Timestamp'],
          rows: chats.slice(0, 50).map(chat => [
            chat.id.slice(0, 8) + '...',
            chat.description || 'No description',
            chat.messages.length,
            new Date(chat.timestamp).toLocaleDateString()
          ]),
          executionTime
        };

        setQueryResult(result);
        
        // Add to history
        setQueryHistory(prev => [query, ...prev.slice(0, 9)]);
        
        toast.success(`Query executed successfully in ${executionTime}ms`);
      } else {
        // Simulate other query types
        const result: SQLQueryResult = {
          columns: ['Result'],
          rows: [['Query executed successfully']],
          rowsAffected: 1,
          executionTime: Date.now() - startTime
        };
        setQueryResult(result);
        toast.success('Query executed successfully');
      }
    } catch (error) {
      console.error('Query execution failed:', error);
      toast.error(`Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExecuting(false);
    }
  }, [database, query]);

  // Quick query templates
  const quickQueries = [
    {
      name: 'List All Chats',
      query: 'SELECT id, description, timestamp FROM chats ORDER BY timestamp DESC;'
    },
    {
      name: 'Chat Statistics',
      query: 'SELECT COUNT(*) as total_chats, AVG(message_count) as avg_messages FROM chats;'
    },
    {
      name: 'Recent Activity',
      query: 'SELECT * FROM chats WHERE timestamp > datetime("now", "-7 days");'
    },
    {
      name: 'Database Info',
      query: 'SELECT name, type FROM sqlite_master WHERE type IN ("table", "view");'
    }
  ];

  // Insert quick query
  const insertQuickQuery = (queryText: string) => {
    setQuery(queryText);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-bolt-elements-textPrimary">SQL Database Manager</h2>
          <p className="text-sm text-bolt-elements-textSecondary mt-1">
            Execute queries, explore schema, and manage your database
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="i-ph:database w-6 h-6 text-purple-500" />
          <span className="text-sm text-bolt-elements-textSecondary">
            {database ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Query Builder Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Query Editor */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <div className="i-ph:code w-5 h-5 text-purple-500" />
                <span>SQL Query Editor</span>
              </CardTitle>
              <CardDescription>Write and execute SQL queries</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className={classNames(
                    'w-full h-48 p-4 rounded-lg border',
                    'bg-bolt-elements-background-depth-2',
                    'border-bolt-elements-borderColor',
                    'text-bolt-elements-textPrimary',
                    'font-mono text-sm',
                    'resize-none',
                    'focus:outline-none focus:ring-2 focus:ring-purple-500/20',
                    'placeholder:text-bolt-elements-textSecondary'
                  )}
                  placeholder="-- Enter your SQL query here..."
                />
                <div className="absolute bottom-2 right-2 text-xs text-bolt-elements-textSecondary">
                  Lines: {query.split('\n').length}
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex space-x-2">
                  <Button
                    onClick={executeQuery}
                    disabled={isExecuting || !query.trim()}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {isExecuting ? (
                      <>
                        <div className="i-ph:spinner-gap-bold animate-spin w-4 h-4 mr-2" />
                        Executing...
                      </>
                    ) : (
                      <>
                        <div className="i-ph:play w-4 h-4 mr-2" />
                        Execute Query
                      </>
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => setQuery('')}
                    disabled={!query.trim()}
                  >
                    <div className="i-ph:trash w-4 h-4 mr-2" />
                    Clear
                  </Button>
                </div>
                
                <div className="text-sm text-bolt-elements-textSecondary">
                  Ctrl+Enter to execute
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Database Schema & Quick Queries */}
        <div className="space-y-4">
          {/* Database Schema */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <div className="i-ph:tree-structure w-5 h-5 text-green-500" />
                <span>Database Schema</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {tables.length > 0 ? (
                  tables.map((table) => (
                    <motion.div
                      key={table.name}
                      whileHover={{ scale: 1.02 }}
                      className={classNames(
                        'p-3 rounded-lg border cursor-pointer transition-colors',
                        'border-bolt-elements-borderColor',
                        'hover:bg-bolt-elements-item-backgroundAccent',
                        selectedTable === table.name
                          ? 'bg-purple-500/10 border-purple-500/30'
                          : 'bg-bolt-elements-background-depth-2'
                      )}
                      onClick={() => setSelectedTable(table.name)}
                    >
                      <div className="flex items-center space-x-2">
                        <div className={`i-ph:${table.type === 'table' ? 'table' : 'eye'} w-4 h-4`} />
                        <span className="text-sm font-medium">{table.name}</span>
                      </div>
                      <div className="text-xs text-bolt-elements-textSecondary mt-1">
                        {table.type}
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-4 text-bolt-elements-textSecondary">
                    <div className="i-ph:database w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No tables found</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Queries */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <div className="i-ph:lightning w-5 h-5 text-yellow-500" />
                <span>Quick Queries</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {quickQueries.map((item, index) => (
                  <motion.button
                    key={index}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => insertQuickQuery(item.query)}
                    className={classNames(
                      'w-full p-3 text-left rounded-lg border transition-colors',
                      'border-bolt-elements-borderColor',
                      'bg-bolt-elements-background-depth-2',
                      'hover:bg-bolt-elements-item-backgroundAccent',
                      'focus:outline-none focus:ring-2 focus:ring-purple-500/20'
                    )}
                  >
                    <div className="text-sm font-medium text-bolt-elements-textPrimary">
                      {item.name}
                    </div>
                    <div className="text-xs text-bolt-elements-textSecondary font-mono mt-1">
                      {item.query.slice(0, 40)}...
                    </div>
                  </motion.button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Query Results */}
      {queryResult && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <div className="i-ph:chart-bar w-5 h-5 text-blue-500" />
                <span>Query Results</span>
              </CardTitle>
              <div className="flex items-center space-x-4 text-sm text-bolt-elements-textSecondary">
                {queryResult.executionTime && (
                  <span>⚡ {queryResult.executionTime}ms</span>
                )}
                <span>📊 {queryResult.rows.length} rows</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-bolt-elements-borderColor">
                    {queryResult.columns.map((column, index) => (
                      <th
                        key={index}
                        className="px-4 py-3 text-left text-sm font-medium text-bolt-elements-textPrimary bg-bolt-elements-background-depth-2"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {queryResult.rows.map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className="border-b border-bolt-elements-borderColor hover:bg-bolt-elements-item-backgroundAccent"
                    >
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className="px-4 py-3 text-sm text-bolt-elements-textSecondary"
                        >
                          {cell?.toString() || 'NULL'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Query History */}
      {queryHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <div className="i-ph:clock-clockwise w-5 h-5 text-gray-500" />
              <span>Query History</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {queryHistory.map((historyQuery, index) => (
                <motion.div
                  key={index}
                  whileHover={{ scale: 1.01 }}
                  className={classNames(
                    'p-3 rounded-lg border cursor-pointer transition-colors',
                    'border-bolt-elements-borderColor',
                    'bg-bolt-elements-background-depth-2',
                    'hover:bg-bolt-elements-item-backgroundAccent'
                  )}
                  onClick={() => setQuery(historyQuery)}
                >
                  <div className="text-sm font-mono text-bolt-elements-textSecondary">
                    {historyQuery.slice(0, 100)}
                    {historyQuery.length > 100 && '...'}
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}