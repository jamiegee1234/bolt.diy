import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { Button } from '~/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '~/components/ui/Card';
import { openDatabase } from '~/lib/persistence/db';
import { getAllChats } from '~/lib/persistence/chats';
import { toast } from 'react-toastify';

interface QueryCondition {
  id: string;
  column: string;
  operator: string;
  value: string;
  logicalOperator?: 'AND' | 'OR';
}

interface QueryBuilder {
  action: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  columns: string[];
  conditions: QueryCondition[];
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

interface Table {
  name: string;
  columns: Column[];
}

interface Column {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
}

interface QuerySuggestion {
  title: string;
  description: string;
  query: string;
  category: 'common' | 'analytics' | 'maintenance' | 'advanced';
}

const OPERATORS = [
  { value: '=', label: 'Equals (=)' },
  { value: '!=', label: 'Not Equals (!=)' },
  { value: '>', label: 'Greater Than (>)' },
  { value: '<', label: 'Less Than (<)' },
  { value: '>=', label: 'Greater or Equal (>=)' },
  { value: '<=', label: 'Less or Equal (<=)' },
  { value: 'LIKE', label: 'Contains (LIKE)' },
  { value: 'NOT LIKE', label: 'Does Not Contain (NOT LIKE)' },
  { value: 'IN', label: 'In List (IN)' },
  { value: 'NOT IN', label: 'Not In List (NOT IN)' },
  { value: 'IS NULL', label: 'Is Empty (IS NULL)' },
  { value: 'IS NOT NULL', label: 'Is Not Empty (IS NOT NULL)' }
];

const QUERY_SUGGESTIONS: QuerySuggestion[] = [
  {
    title: 'List All Chats',
    description: 'Get all chat conversations with basic info',
    query: 'SELECT id, description, timestamp FROM chats ORDER BY timestamp DESC',
    category: 'common'
  },
  {
    title: 'Recent Chats (Last 7 Days)',
    description: 'Find chats created in the last week',
    query: `SELECT * FROM chats WHERE timestamp >= datetime('now', '-7 days') ORDER BY timestamp DESC`,
    category: 'common'
  },
  {
    title: 'Chat Statistics',
    description: 'Analyze chat usage patterns',
    query: 'SELECT COUNT(*) as total_chats, AVG(json_array_length(messages)) as avg_messages FROM chats',
    category: 'analytics'
  },
  {
    title: 'Most Active Chats',
    description: 'Find chats with the most messages',
    query: 'SELECT id, description, json_array_length(messages) as message_count FROM chats ORDER BY message_count DESC LIMIT 10',
    category: 'analytics'
  },
  {
    title: 'Find Empty Chats',
    description: 'Locate chats without messages',
    query: 'SELECT * FROM chats WHERE json_array_length(messages) = 0',
    category: 'maintenance'
  },
  {
    title: 'Database Schema Info',
    description: 'Get information about database structure',
    query: `SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') ORDER BY name`,
    category: 'advanced'
  }
];

export function SQLQueryBuilder() {
  const [queryBuilder, setQueryBuilder] = useState<QueryBuilder>({
    action: 'SELECT',
    table: '',
    columns: ['*'],
    conditions: []
  });
  
  const [tables, setTables] = useState<Table[]>([]);
  const [database, setDatabase] = useState<IDBDatabase | null>(null);
  const [generatedQuery, setGeneratedQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'visual' | 'suggestions' | 'history'>('visual');
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<QuerySuggestion | null>(null);

  // Initialize database and load schema
  useEffect(() => {
    const initDatabase = async () => {
      try {
        setIsLoading(true);
        const db = await openDatabase();
        setDatabase(db);
        await loadTables(db);
      } catch (error) {
        console.error('Failed to initialize database:', error);
        toast.error('Failed to connect to database');
      } finally {
        setIsLoading(false);
      }
    };

    initDatabase();
  }, []);

  // Load available tables and their columns
  const loadTables = useCallback(async (db: IDBDatabase) => {
    const tablesList: Table[] = [];

    // For IndexedDB, we'll simulate table structure
    Array.from(db.objectStoreNames).forEach(storeName => {
      if (storeName === 'chats') {
        tablesList.push({
          name: storeName,
          columns: [
            { name: 'id', type: 'TEXT', nullable: false, primaryKey: true },
            { name: 'description', type: 'TEXT', nullable: true, primaryKey: false },
            { name: 'messages', type: 'JSON', nullable: false, primaryKey: false },
            { name: 'timestamp', type: 'TEXT', nullable: false, primaryKey: false },
            { name: 'urlId', type: 'TEXT', nullable: true, primaryKey: false }
          ]
        });
      } else {
        tablesList.push({
          name: storeName,
          columns: [
            { name: 'id', type: 'TEXT', nullable: false, primaryKey: true },
            { name: 'data', type: 'JSON', nullable: false, primaryKey: false },
            { name: 'timestamp', type: 'TEXT', nullable: false, primaryKey: false }
          ]
        });
      }
    });

    setTables(tablesList);
    
    // Set default table if available
    if (tablesList.length > 0 && !queryBuilder.table) {
      setQueryBuilder(prev => ({ ...prev, table: tablesList[0].name }));
    }
  }, [queryBuilder.table]);

  // Get columns for selected table
  const selectedTableColumns = useMemo(() => {
    const table = tables.find(t => t.name === queryBuilder.table);
    return table?.columns || [];
  }, [tables, queryBuilder.table]);

  // Generate SQL query from visual builder
  const generateQuery = useCallback(() => {
    const { action, table, columns, conditions, orderBy, orderDirection, limit, offset } = queryBuilder;

    if (!table) return '';

    let query = '';

    switch (action) {
      case 'SELECT':
        query = `SELECT ${columns.join(', ')} FROM ${table}`;
        
        if (conditions.length > 0) {
          const whereClause = conditions.map((condition, index) => {
            let clause = `${condition.column} ${condition.operator}`;
            
            if (!['IS NULL', 'IS NOT NULL'].includes(condition.operator)) {
              if (condition.operator === 'LIKE' || condition.operator === 'NOT LIKE') {
                clause += ` '%${condition.value}%'`;
              } else if (condition.operator === 'IN' || condition.operator === 'NOT IN') {
                clause += ` (${condition.value})`;
              } else {
                clause += ` '${condition.value}'`;
              }
            }
            
            if (index > 0 && condition.logicalOperator) {
              clause = `${condition.logicalOperator} ${clause}`;
            }
            
            return clause;
          }).join(' ');
          
          query += ` WHERE ${whereClause}`;
        }

        if (orderBy) {
          query += ` ORDER BY ${orderBy} ${orderDirection || 'ASC'}`;
        }

        if (limit) {
          query += ` LIMIT ${limit}`;
        }

        if (offset) {
          query += ` OFFSET ${offset}`;
        }
        break;

      case 'INSERT':
        query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
        break;

      case 'UPDATE':
        query = `UPDATE ${table} SET ${columns.map(col => `${col} = ?`).join(', ')}`;
        if (conditions.length > 0) {
          const whereClause = conditions.map(condition => 
            `${condition.column} ${condition.operator} '${condition.value}'`
          ).join(' AND ');
          query += ` WHERE ${whereClause}`;
        }
        break;

      case 'DELETE':
        query = `DELETE FROM ${table}`;
        if (conditions.length > 0) {
          const whereClause = conditions.map(condition => 
            `${condition.column} ${condition.operator} '${condition.value}'`
          ).join(' AND ');
          query += ` WHERE ${whereClause}`;
        }
        break;
    }

    return query + ';';
  }, [queryBuilder]);

  // Update generated query when builder changes
  useEffect(() => {
    const query = generateQuery();
    setGeneratedQuery(query);
  }, [generateQuery]);

  // Add condition
  const addCondition = () => {
    const newCondition: QueryCondition = {
      id: Date.now().toString(),
      column: selectedTableColumns[0]?.name || '',
      operator: '=',
      value: '',
      logicalOperator: queryBuilder.conditions.length > 0 ? 'AND' : undefined
    };
    
    setQueryBuilder(prev => ({
      ...prev,
      conditions: [...prev.conditions, newCondition]
    }));
  };

  // Update condition
  const updateCondition = (id: string, updates: Partial<QueryCondition>) => {
    setQueryBuilder(prev => ({
      ...prev,
      conditions: prev.conditions.map(condition =>
        condition.id === id ? { ...condition, ...updates } : condition
      )
    }));
  };

  // Remove condition
  const removeCondition = (id: string) => {
    setQueryBuilder(prev => ({
      ...prev,
      conditions: prev.conditions.filter(condition => condition.id !== id)
    }));
  };

  // Apply suggestion
  const applySuggestion = (suggestion: QuerySuggestion) => {
    setGeneratedQuery(suggestion.query);
    setSelectedSuggestion(suggestion);
    toast.success(`Applied: ${suggestion.title}`);
  };

  // Execute query (placeholder for now)
  const executeQuery = async () => {
    if (!generatedQuery.trim()) {
      toast.error('Please enter a query');
      return;
    }

    // Add to history
    setQueryHistory(prev => [generatedQuery, ...prev.slice(0, 9)]);
    
    // Simulate execution
    toast.success('Query executed successfully (simulated)');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="i-ph:spinner-gap-bold animate-spin w-8 h-8 mx-auto mb-4 text-purple-500" />
          <p className="text-bolt-elements-textSecondary">Loading query builder...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-bolt-elements-textPrimary">SQL Query Builder</h2>
          <p className="text-sm text-bolt-elements-textSecondary mt-1">
            Build queries visually or use pre-made suggestions
          </p>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex items-center space-x-2">
          {(['visual', 'suggestions', 'history'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={classNames(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                activeTab === tab
                  ? 'bg-purple-500 text-white'
                  : 'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary'
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Query Builder Panel */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <div className="i-ph:wrench w-5 h-5 text-purple-500" />
                <span>Query Builder</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <AnimatePresence mode="wait">
                {activeTab === 'visual' && (
                  <motion.div
                    key="visual"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-4"
                  >
                    {/* Action & Table Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">
                          Action
                        </label>
                        <select
                          value={queryBuilder.action}
                          onChange={(e) => setQueryBuilder(prev => ({ ...prev, action: e.target.value as any }))}
                          className={classNames(
                            'w-full p-2 border rounded-lg',
                            'bg-bolt-elements-background-depth-2',
                            'border-bolt-elements-borderColor',
                            'text-bolt-elements-textPrimary',
                            'focus:outline-none focus:ring-2 focus:ring-purple-500/20'
                          )}
                        >
                          <option value="SELECT">SELECT</option>
                          <option value="INSERT">INSERT</option>
                          <option value="UPDATE">UPDATE</option>
                          <option value="DELETE">DELETE</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">
                          Table
                        </label>
                        <select
                          value={queryBuilder.table}
                          onChange={(e) => setQueryBuilder(prev => ({ ...prev, table: e.target.value }))}
                          className={classNames(
                            'w-full p-2 border rounded-lg',
                            'bg-bolt-elements-background-depth-2',
                            'border-bolt-elements-borderColor',
                            'text-bolt-elements-textPrimary',
                            'focus:outline-none focus:ring-2 focus:ring-purple-500/20'
                          )}
                        >
                          {tables.map(table => (
                            <option key={table.name} value={table.name}>
                              {table.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Columns Selection */}
                    {queryBuilder.action === 'SELECT' && (
                      <div>
                        <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">
                          Columns
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => setQueryBuilder(prev => ({ ...prev, columns: ['*'] }))}
                            className={classNames(
                              'px-3 py-1 text-sm rounded-lg border transition-colors',
                              queryBuilder.columns.includes('*')
                                ? 'bg-purple-500 text-white border-purple-500'
                                : 'bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary'
                            )}
                          >
                            * (All)
                          </button>
                          {selectedTableColumns.map(column => (
                            <button
                              key={column.name}
                              onClick={() => {
                                const newColumns = queryBuilder.columns.includes('*') 
                                  ? [column.name]
                                  : queryBuilder.columns.includes(column.name)
                                    ? queryBuilder.columns.filter(c => c !== column.name)
                                    : [...queryBuilder.columns.filter(c => c !== '*'), column.name];
                                setQueryBuilder(prev => ({ ...prev, columns: newColumns.length ? newColumns : ['*'] }));
                              }}
                              className={classNames(
                                'px-3 py-1 text-sm rounded-lg border transition-colors',
                                queryBuilder.columns.includes(column.name) && !queryBuilder.columns.includes('*')
                                  ? 'bg-blue-500 text-white border-blue-500'
                                  : 'bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary'
                              )}
                            >
                              {column.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Conditions */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-bolt-elements-textPrimary">
                          Conditions
                        </label>
                        <Button
                          onClick={addCondition}
                          size="sm"
                          variant="outline"
                          className="text-xs"
                        >
                          <div className="i-ph:plus w-3 h-3 mr-1" />
                          Add Condition
                        </Button>
                      </div>
                      
                      <div className="space-y-2">
                        {queryBuilder.conditions.map((condition, index) => (
                          <motion.div
                            key={condition.id}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-3 border border-bolt-elements-borderColor rounded-lg bg-bolt-elements-background-depth-2"
                          >
                            <div className="grid grid-cols-12 gap-2 items-center">
                              {index > 0 && (
                                <div className="col-span-2">
                                  <select
                                    value={condition.logicalOperator || 'AND'}
                                    onChange={(e) => updateCondition(condition.id, { logicalOperator: e.target.value as any })}
                                    className="w-full p-1 text-xs border rounded bg-bolt-elements-background-depth-1 border-bolt-elements-borderColor"
                                  >
                                    <option value="AND">AND</option>
                                    <option value="OR">OR</option>
                                  </select>
                                </div>
                              )}
                              
                              <div className={index > 0 ? "col-span-3" : "col-span-4"}>
                                <select
                                  value={condition.column}
                                  onChange={(e) => updateCondition(condition.id, { column: e.target.value })}
                                  className="w-full p-1 text-xs border rounded bg-bolt-elements-background-depth-1 border-bolt-elements-borderColor"
                                >
                                  {selectedTableColumns.map(column => (
                                    <option key={column.name} value={column.name}>
                                      {column.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              
                              <div className="col-span-3">
                                <select
                                  value={condition.operator}
                                  onChange={(e) => updateCondition(condition.id, { operator: e.target.value })}
                                  className="w-full p-1 text-xs border rounded bg-bolt-elements-background-depth-1 border-bolt-elements-borderColor"
                                >
                                  {OPERATORS.map(op => (
                                    <option key={op.value} value={op.value}>
                                      {op.value}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              
                              {!['IS NULL', 'IS NOT NULL'].includes(condition.operator) && (
                                <div className="col-span-3">
                                  <input
                                    type="text"
                                    value={condition.value}
                                    onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                                    placeholder="Value"
                                    className="w-full p-1 text-xs border rounded bg-bolt-elements-background-depth-1 border-bolt-elements-borderColor"
                                  />
                                </div>
                              )}
                              
                              <div className="col-span-1">
                                <button
                                  onClick={() => removeCondition(condition.id)}
                                  className="i-ph:trash w-4 h-4 text-red-500 hover:text-red-700"
                                />
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Order By & Limit */}
                    {queryBuilder.action === 'SELECT' && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">
                            Order By
                          </label>
                          <select
                            value={queryBuilder.orderBy || ''}
                            onChange={(e) => setQueryBuilder(prev => ({ ...prev, orderBy: e.target.value || undefined }))}
                            className={classNames(
                              'w-full p-2 border rounded-lg',
                              'bg-bolt-elements-background-depth-2',
                              'border-bolt-elements-borderColor',
                              'text-bolt-elements-textPrimary',
                              'focus:outline-none focus:ring-2 focus:ring-purple-500/20'
                            )}
                          >
                            <option value="">None</option>
                            {selectedTableColumns.map(column => (
                              <option key={column.name} value={column.name}>
                                {column.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">
                            Direction
                          </label>
                          <select
                            value={queryBuilder.orderDirection || 'ASC'}
                            onChange={(e) => setQueryBuilder(prev => ({ ...prev, orderDirection: e.target.value as any }))}
                            className={classNames(
                              'w-full p-2 border rounded-lg',
                              'bg-bolt-elements-background-depth-2',
                              'border-bolt-elements-borderColor',
                              'text-bolt-elements-textPrimary',
                              'focus:outline-none focus:ring-2 focus:ring-purple-500/20'
                            )}
                          >
                            <option value="ASC">Ascending</option>
                            <option value="DESC">Descending</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">
                            Limit
                          </label>
                          <input
                            type="number"
                            value={queryBuilder.limit || ''}
                            onChange={(e) => setQueryBuilder(prev => ({ ...prev, limit: e.target.value ? parseInt(e.target.value) : undefined }))}
                            placeholder="No limit"
                            className={classNames(
                              'w-full p-2 border rounded-lg',
                              'bg-bolt-elements-background-depth-2',
                              'border-bolt-elements-borderColor',
                              'text-bolt-elements-textPrimary',
                              'focus:outline-none focus:ring-2 focus:ring-purple-500/20'
                            )}
                          />
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === 'suggestions' && (
                  <motion.div
                    key="suggestions"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-4"
                  >
                    {Object.entries(
                      QUERY_SUGGESTIONS.reduce((acc, suggestion) => {
                        if (!acc[suggestion.category]) acc[suggestion.category] = [];
                        acc[suggestion.category].push(suggestion);
                        return acc;
                      }, {} as Record<string, QuerySuggestion[]>)
                    ).map(([category, suggestions]) => (
                      <div key={category}>
                        <h3 className="text-sm font-semibold text-bolt-elements-textPrimary mb-3 capitalize">
                          {category} Queries
                        </h3>
                        <div className="space-y-2">
                          {suggestions.map((suggestion, index) => (
                            <motion.div
                              key={index}
                              whileHover={{ scale: 1.01 }}
                              className={classNames(
                                'p-3 border rounded-lg cursor-pointer transition-all',
                                'border-bolt-elements-borderColor',
                                'bg-bolt-elements-background-depth-2',
                                'hover:bg-bolt-elements-item-backgroundAccent',
                                'hover:border-purple-500/30'
                              )}
                              onClick={() => applySuggestion(suggestion)}
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <h4 className="font-medium text-bolt-elements-textPrimary">
                                    {suggestion.title}
                                  </h4>
                                  <p className="text-sm text-bolt-elements-textSecondary mt-1">
                                    {suggestion.description}
                                  </p>
                                  <code className="text-xs text-bolt-elements-textSecondary bg-bolt-elements-background-depth-1 px-2 py-1 rounded mt-2 inline-block font-mono">
                                    {suggestion.query.slice(0, 60)}...
                                  </code>
                                </div>
                                <div className="i-ph:arrow-right w-4 h-4 text-bolt-elements-textSecondary" />
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}

                {activeTab === 'history' && (
                  <motion.div
                    key="history"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-4"
                  >
                    {queryHistory.length > 0 ? (
                      queryHistory.map((query, index) => (
                        <motion.div
                          key={index}
                          whileHover={{ scale: 1.01 }}
                          className={classNames(
                            'p-3 border rounded-lg cursor-pointer transition-all',
                            'border-bolt-elements-borderColor',
                            'bg-bolt-elements-background-depth-2',
                            'hover:bg-bolt-elements-item-backgroundAccent'
                          )}
                          onClick={() => setGeneratedQuery(query)}
                        >
                          <code className="text-sm font-mono text-bolt-elements-textSecondary">
                            {query}
                          </code>
                        </motion.div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-bolt-elements-textSecondary">
                        <div className="i-ph:clock-clockwise w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No query history yet</p>
                        <p className="text-sm">Execute some queries to see them here</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </div>

        {/* Generated Query & Actions */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <div className="i-ph:code w-5 h-5 text-green-500" />
                <span>Generated Query</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <textarea
                  value={generatedQuery}
                  onChange={(e) => setGeneratedQuery(e.target.value)}
                  className={classNames(
                    'w-full h-48 p-3 border rounded-lg font-mono text-sm',
                    'bg-bolt-elements-background-depth-2',
                    'border-bolt-elements-borderColor',
                    'text-bolt-elements-textPrimary',
                    'focus:outline-none focus:ring-2 focus:ring-purple-500/20',
                    'resize-none'
                  )}
                  placeholder="Generated SQL query will appear here..."
                />
                <div className="absolute bottom-2 right-2 text-xs text-bolt-elements-textSecondary">
                  {generatedQuery.length} chars
                </div>
              </div>

              <div className="space-y-2">
                <Button
                  onClick={executeQuery}
                  disabled={!generatedQuery.trim()}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <div className="i-ph:play w-4 h-4 mr-2" />
                  Execute Query
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedQuery);
                      toast.success('Query copied to clipboard');
                    }}
                    disabled={!generatedQuery.trim()}
                  >
                    <div className="i-ph:copy w-4 h-4 mr-1" />
                    Copy
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setGeneratedQuery('')}
                    disabled={!generatedQuery.trim()}
                  >
                    <div className="i-ph:trash w-4 h-4 mr-1" />
                    Clear
                  </Button>
                </div>
              </div>

              {/* Query Stats */}
              {generatedQuery && (
                <div className="mt-4 p-3 bg-bolt-elements-background-depth-2 rounded-lg">
                  <h4 className="text-sm font-medium text-bolt-elements-textPrimary mb-2">
                    Query Analysis
                  </h4>
                  <div className="space-y-1 text-xs text-bolt-elements-textSecondary">
                    <div>Type: {generatedQuery.trim().split(' ')[0].toUpperCase()}</div>
                    <div>Length: {generatedQuery.length} characters</div>
                    <div>Lines: {generatedQuery.split('\n').length}</div>
                    {generatedQuery.toLowerCase().includes('select') && (
                      <div>Estimated complexity: {queryBuilder.conditions.length > 2 ? 'High' : queryBuilder.conditions.length > 0 ? 'Medium' : 'Low'}</div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}