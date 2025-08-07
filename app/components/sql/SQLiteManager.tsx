import { useState, useEffect, useCallback } from 'react';
import { Button } from '~/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '~/components/ui/Card';
import { Input } from '~/components/ui/Input';
import { Label } from '~/components/ui/Label';
import { Switch } from '~/components/ui/Switch';
import { Dialog } from '~/components/ui/Dialog';
import { toast } from 'react-toastify';

interface DatabaseConnection {
  id: string;
  name: string;
  type: 'sqlite' | 'supabase' | 'postgres';
  connectionString?: string;
  isConnected: boolean;
  lastConnected?: Date;
  tables?: string[];
}

interface SQLiteManagerProps {
  onConnectionSelect?: (connection: DatabaseConnection) => void;
  onSchemaChange?: () => void;
}

export function SQLiteManager({ onConnectionSelect, onSchemaChange }: SQLiteManagerProps) {
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [activeConnection, setActiveConnection] = useState<DatabaseConnection | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [newConnection, setNewConnection] = useState({
    name: '',
    type: 'sqlite' as const,
    connectionString: ''
  });

  // Load existing connections from localStorage
  useEffect(() => {
    const savedConnections = localStorage.getItem('sql-connections');
    if (savedConnections) {
      try {
        setConnections(JSON.parse(savedConnections));
      } catch (error) {
        console.error('Failed to load saved connections:', error);
      }
    }
  }, []);

  // Save connections to localStorage
  const saveConnections = useCallback((conns: DatabaseConnection[]) => {
    localStorage.setItem('sql-connections', JSON.stringify(conns));
    setConnections(conns);
  }, []);

  // Create new database connection
  const createConnection = useCallback(async () => {
    if (!newConnection.name.trim()) {
      toast.error('Connection name is required');
      return;
    }

    setIsLoading(true);
    try {
      const connection: DatabaseConnection = {
        id: crypto.randomUUID(),
        name: newConnection.name,
        type: newConnection.type,
        connectionString: newConnection.connectionString,
        isConnected: false,
        tables: []
      };

      // Test connection
      if (newConnection.type === 'sqlite') {
        // For demo purposes, create a basic SQLite connection
        connection.isConnected = true;
        connection.lastConnected = new Date();
        connection.tables = ['users', 'posts', 'comments']; // Demo tables
      }

      const updatedConnections = [...connections, connection];
      saveConnections(updatedConnections);
      
      setIsCreateDialogOpen(false);
      setNewConnection({ name: '', type: 'sqlite', connectionString: '' });
      toast.success('Database connection created successfully');
    } catch (error) {
      toast.error('Failed to create database connection');
      console.error('Connection error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [newConnection, connections, saveConnections]);

  // Connect to database
  const connectToDatabase = useCallback(async (connection: DatabaseConnection) => {
    setIsLoading(true);
    try {
      // Simulate connection process
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const updatedConnection = {
        ...connection,
        isConnected: true,
        lastConnected: new Date()
      };

      const updatedConnections = connections.map(conn => 
        conn.id === connection.id ? updatedConnection : conn
      );
      
      saveConnections(updatedConnections);
      setActiveConnection(updatedConnection);
      onConnectionSelect?.(updatedConnection);
      
      toast.success(`Connected to ${connection.name}`);
    } catch (error) {
      toast.error('Failed to connect to database');
      console.error('Connection error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [connections, saveConnections, onConnectionSelect]);

  // Disconnect from database
  const disconnectFromDatabase = useCallback((connection: DatabaseConnection) => {
    const updatedConnection = { ...connection, isConnected: false };
    const updatedConnections = connections.map(conn => 
      conn.id === connection.id ? updatedConnection : conn
    );
    
    saveConnections(updatedConnections);
    if (activeConnection?.id === connection.id) {
      setActiveConnection(null);
    }
    
    toast.info(`Disconnected from ${connection.name}`);
  }, [connections, saveConnections, activeConnection]);

  // Delete connection
  const deleteConnection = useCallback((connectionId: string) => {
    const updatedConnections = connections.filter(conn => conn.id !== connectionId);
    saveConnections(updatedConnections);
    
    if (activeConnection?.id === connectionId) {
      setActiveConnection(null);
    }
    
    toast.success('Connection deleted');
  }, [connections, saveConnections, activeConnection]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-bolt-elements-textPrimary">
            Database Connections
          </h2>
          <p className="text-sm text-bolt-elements-textSecondary mt-1">
            Manage your database connections and schemas
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <div className="i-ph:plus mr-2" />
          Add Connection
        </Button>
      </div>

      {/* Active Connection Status */}
      {activeConnection && (
        <Card className="border-green-500/20 bg-green-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                <div>
                  <p className="font-medium text-bolt-elements-textPrimary">
                    Connected to {activeConnection.name}
                  </p>
                  <p className="text-sm text-bolt-elements-textSecondary">
                    {activeConnection.tables?.length || 0} tables available
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => disconnectFromDatabase(activeConnection)}
              >
                Disconnect
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connections List */}
      <div className="grid gap-4">
        {connections.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="i-ph:database text-4xl text-bolt-elements-textSecondary mb-4 mx-auto" />
              <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-2">
                No database connections
              </h3>
              <p className="text-bolt-elements-textSecondary mb-4">
                Create your first database connection to get started
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <div className="i-ph:plus mr-2" />
                Add Connection
              </Button>
            </CardContent>
          </Card>
        ) : (
          connections.map((connection) => (
            <Card key={connection.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      connection.isConnected ? 'bg-green-500' : 'bg-gray-400'
                    }`} />
                    <div>
                      <h3 className="font-medium text-bolt-elements-textPrimary">
                        {connection.name}
                      </h3>
                      <p className="text-sm text-bolt-elements-textSecondary">
                        {connection.type.toUpperCase()} • {
                          connection.isConnected ? 'Connected' : 'Disconnected'
                        }
                        {connection.lastConnected && (
                          <> • Last connected {connection.lastConnected.toLocaleDateString()}</>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {connection.isConnected ? (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => disconnectFromDatabase(connection)}
                        disabled={isLoading}
                      >
                        Disconnect
                      </Button>
                    ) : (
                      <Button 
                        size="sm"
                        onClick={() => connectToDatabase(connection)}
                        disabled={isLoading}
                      >
                        {isLoading ? 'Connecting...' : 'Connect'}
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => deleteConnection(connection.id)}
                      className="text-red-500 hover:text-red-600"
                    >
                      <div className="i-ph:trash" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Connection Dialog */}
      <Dialog 
        isOpen={isCreateDialogOpen} 
        onClose={() => setIsCreateDialogOpen(false)}
        title="Create Database Connection"
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Connection Name</Label>
            <Input
              id="name"
              value={newConnection.name}
              onChange={(e) => setNewConnection({ ...newConnection, name: e.target.value })}
              placeholder="My Database"
            />
          </div>

          <div>
            <Label htmlFor="type">Database Type</Label>
            <select
              id="type"
              value={newConnection.type}
              onChange={(e) => setNewConnection({ ...newConnection, type: e.target.value as any })}
              className="w-full px-3 py-2 border border-bolt-elements-borderColor rounded-md bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary"
            >
              <option value="sqlite">SQLite</option>
              <option value="postgres">PostgreSQL</option>
              <option value="supabase">Supabase</option>
            </select>
          </div>

          {newConnection.type !== 'sqlite' && (
            <div>
              <Label htmlFor="connectionString">Connection String</Label>
              <Input
                id="connectionString"
                type="password"
                value={newConnection.connectionString}
                onChange={(e) => setNewConnection({ ...newConnection, connectionString: e.target.value })}
                placeholder="postgresql://username:password@localhost:5432/database"
              />
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => setIsCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={createConnection}
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create Connection'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}