import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '~/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '~/components/ui/Card';
import { Badge } from '~/components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/Tabs';
import { toast } from 'react-toastify';

interface QueryResult {
  id: string;
  query: string;
  results?: any[];
  columns?: string[];
  rowCount?: number;
  executionTime?: number;
  error?: string;
  timestamp: Date;
}

interface SQLQueryBuilderProps {
  connectionName?: string;
  onQueryExecute?: (query: string) => Promise<QueryResult>;
}

// Mock query execution for demonstration
const mockQueryExecution = async (query: string): Promise<QueryResult> => {
  // Simulate execution time
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
  
  const queryLower = query.toLowerCase().trim();
  
  // Mock different types of responses
  if (queryLower.includes('select')) {
    return {
      id: crypto.randomUUID(),
      query,
      results: [
        { id: 1, email: 'john@example.com', username: 'john_doe', first_name: 'John', last_name: 'Doe', created_at: '2024-01-15T10:30:00Z' },
        { id: 2, email: 'jane@example.com', username: 'jane_smith', first_name: 'Jane', last_name: 'Smith', created_at: '2024-01-16T14:22:00Z' },
        { id: 3, email: 'bob@example.com', username: 'bob_wilson', first_name: 'Bob', last_name: 'Wilson', created_at: '2024-01-17T09:15:00Z' }
      ],
      columns: ['id', 'email', 'username', 'first_name', 'last_name', 'created_at'],
      rowCount: 3,
      executionTime: 245,
      timestamp: new Date()
    };
  } else if (queryLower.includes('insert') || queryLower.includes('update') || queryLower.includes('delete')) {
    return {
      id: crypto.randomUUID(),
      query,
      rowCount: Math.floor(Math.random() * 5) + 1,
      executionTime: 120,
      timestamp: new Date()
    };
  } else if (queryLower.includes('create') || queryLower.includes('alter') || queryLower.includes('drop')) {
    return {
      id: crypto.randomUUID(),
      query,
      executionTime: 89,
      timestamp: new Date()
    };
  } else {
    throw new Error('Invalid SQL syntax or unsupported operation');
  }
};

const QUERY_TEMPLATES = [
  {
    name: 'Select All Users',
    query: 'SELECT * FROM users ORDER BY created_at DESC LIMIT 10;'
  },
  {
    name: 'Count Posts by User',
    query: 'SELECT u.username, COUNT(p.id) as post_count\nFROM users u\nLEFT JOIN posts p ON u.id = p.user_id\nGROUP BY u.id, u.username\nORDER BY post_count DESC;'
  },
  {
    name: 'Recent Comments with User Info',
    query: 'SELECT c.content, u.username, p.title, c.created_at\nFROM comments c\nJOIN users u ON c.user_id = u.id\nJOIN posts p ON c.post_id = p.id\nORDER BY c.created_at DESC\nLIMIT 20;'
  },
  {
    name: 'Create New Table',
    query: 'CREATE TABLE IF NOT EXISTS tags (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  name VARCHAR(50) NOT NULL UNIQUE,\n  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n);'
  }
];

export function SQLQueryBuilder({ 
  connectionName = 'Database', 
  onQueryExecute = mockQueryExecution 
}: SQLQueryBuilderProps) {
  const [query, setQuery] = useState('');
  const [queryHistory, setQueryHistory] = useState<QueryResult[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeTab, setActiveTab] = useState('editor');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load query history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('sql-query-history');
    if (savedHistory) {
      try {
        const history = JSON.parse(savedHistory);
        setQueryHistory(history.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        })));
      } catch (error) {
        console.error('Failed to load query history:', error);
      }
    }
  }, []);

  // Save query history to localStorage
  const saveHistory = useCallback((history: QueryResult[]) => {
    localStorage.setItem('sql-query-history', JSON.stringify(history));
  }, []);

  // Execute SQL query
  const executeQuery = useCallback(async () => {
    if (!query.trim()) {
      toast.error('Please enter a SQL query');
      return;
    }

    setIsExecuting(true);
    try {
      const result = await onQueryExecute(query);
      const newHistory = [result, ...queryHistory.slice(0, 49)]; // Keep last 50 queries
      setQueryHistory(newHistory);
      saveHistory(newHistory);
      setActiveTab('results');
      
      if (result.error) {
        toast.error(`Query failed: ${result.error}`);
      } else {
        toast.success(`Query executed successfully in ${result.executionTime}ms`);
      }
    } catch (error) {
      const errorResult: QueryResult = {
        id: crypto.randomUUID(),
        query,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
      const newHistory = [errorResult, ...queryHistory.slice(0, 49)];
      setQueryHistory(newHistory);
      saveHistory(newHistory);
      setActiveTab('results');
      toast.error(`Query failed: ${errorResult.error}`);
    } finally {
      setIsExecuting(false);
    }
  }, [query, queryHistory, onQueryExecute, saveHistory]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      executeQuery();
    }
  }, [executeQuery]);

  // Load template query
  const loadTemplate = useCallback((template: string) => {
    setQuery(template);
    textareaRef.current?.focus();
  }, []);

  // Format query result for display
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const currentResult = queryHistory[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-bolt-elements-textPrimary">
            SQL Query Builder
          </h2>
          <p className="text-sm text-bolt-elements-textSecondary mt-1">
            Connected to {connectionName}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-xs">
            Ctrl+Enter to execute
          </Badge>
          <Button 
            onClick={executeQuery} 
            disabled={isExecuting || !query.trim()}
            className="bg-green-600 hover:bg-green-700"
          >
            {isExecuting ? (
              <>
                <div className="i-ph:spinner animate-spin mr-2" />
                Executing...
              </>
            ) : (
              <>
                <div className="i-ph:play mr-2" />
                Execute Query
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="results">
            Results
            {queryHistory.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {queryHistory.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Query Editor */}
        <TabsContent value="editor" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <textarea
                ref={textareaRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter your SQL query here...
Example: SELECT * FROM users WHERE created_at > '2024-01-01';"
                className="w-full h-64 p-4 font-mono text-sm border-0 bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
              />
            </CardContent>
          </Card>
          
          <div className="flex justify-between items-center">
            <div className="text-sm text-bolt-elements-textSecondary">
              {query.length} characters • {query.split(/\n/).length} lines
            </div>
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setQuery('')}
              >
                Clear
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Query Results */}
        <TabsContent value="results">
          {currentResult ? (
            <div className="space-y-4">
              {/* Result Header */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-bolt-elements-textPrimary">
                        {currentResult.error ? 'Query Failed' : 'Query Executed Successfully'}
                      </p>
                      <p className="text-sm text-bolt-elements-textSecondary">
                        {currentResult.timestamp.toLocaleString()}
                        {currentResult.executionTime && ` • ${currentResult.executionTime}ms`}
                        {currentResult.rowCount !== undefined && ` • ${currentResult.rowCount} rows affected`}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {currentResult.error ? (
                        <Badge className="bg-red-100 text-red-800">Error</Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-800">Success</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Query Display */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Executed Query</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-sm font-mono bg-bolt-elements-background-depth-1 p-3 rounded-lg overflow-x-auto">
                    {currentResult.query}
                  </pre>
                </CardContent>
              </Card>

              {/* Error Display */}
              {currentResult.error && (
                <Card className="border-red-200">
                  <CardHeader>
                    <CardTitle className="text-sm text-red-600">Error Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-red-600 font-mono bg-red-50 p-3 rounded-lg">
                      {currentResult.error}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Results Table */}
              {currentResult.results && currentResult.results.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">
                      Results ({currentResult.results.length} rows)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-bolt-elements-borderColor">
                            {currentResult.columns?.map((column) => (
                              <th key={column} className="text-left p-2 font-medium text-bolt-elements-textPrimary">
                                {column}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {currentResult.results.map((row, index) => (
                            <tr key={index} className="border-b border-bolt-elements-borderColor hover:bg-bolt-elements-background-depth-1">
                              {currentResult.columns?.map((column) => (
                                <td key={column} className="p-2 text-bolt-elements-textSecondary max-w-xs truncate">
                                  {formatValue(row[column])}
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
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="i-ph:terminal-window text-4xl text-bolt-elements-textSecondary mb-4 mx-auto" />
                <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-2">
                  No results yet
                </h3>
                <p className="text-bolt-elements-textSecondary">
                  Execute a query to see results here
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Query Templates */}
        <TabsContent value="templates">
          <div className="grid gap-4">
            {QUERY_TEMPLATES.map((template, index) => (
              <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-4" onClick={() => loadTemplate(template.query)}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-bolt-elements-textPrimary mb-1">
                        {template.name}
                      </h3>
                      <pre className="text-sm text-bolt-elements-textSecondary font-mono line-clamp-2">
                        {template.query}
                      </pre>
                    </div>
                    <Button variant="outline" size="sm">
                      Use Template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Query History */}
        <TabsContent value="history">
          {queryHistory.length > 0 ? (
            <div className="space-y-4">
              {queryHistory.map((result) => (
                <Card key={result.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-4" onClick={() => setQuery(result.query)}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {result.error ? (
                          <Badge className="bg-red-100 text-red-800">Error</Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-800">Success</Badge>
                        )}
                        <span className="text-sm text-bolt-elements-textSecondary">
                          {result.timestamp.toLocaleString()}
                        </span>
                      </div>
                      <Button variant="outline" size="sm">
                        Load Query
                      </Button>
                    </div>
                    <pre className="text-sm font-mono text-bolt-elements-textSecondary line-clamp-3">
                      {result.query}
                    </pre>
                    {result.rowCount !== undefined && (
                      <p className="text-xs text-bolt-elements-textSecondary mt-2">
                        {result.rowCount} rows affected
                        {result.executionTime && ` • ${result.executionTime}ms`}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="i-ph:clock-clockwise text-4xl text-bolt-elements-textSecondary mb-4 mx-auto" />
                <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-2">
                  No query history
                </h3>
                <p className="text-bolt-elements-textSecondary">
                  Your executed queries will appear here
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}