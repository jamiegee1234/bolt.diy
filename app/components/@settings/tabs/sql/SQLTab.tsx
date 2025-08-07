import { useState, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/Tabs';
import { Card, CardContent } from '~/components/ui/Card';
import { Badge } from '~/components/ui/Badge';
import { SQLiteManager } from '~/components/sql/SQLiteManager';
import { DatabaseSchemaVisualizer } from '~/components/sql/DatabaseSchemaVisualizer';
import { SQLQueryBuilder } from '~/components/sql/SQLQueryBuilder';

interface DatabaseConnection {
  id: string;
  name: string;
  type: 'sqlite' | 'supabase' | 'postgres';
  connectionString?: string;
  isConnected: boolean;
  lastConnected?: Date;
  tables?: string[];
}

interface Table {
  name: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    defaultValue?: string;
    primaryKey?: boolean;
    foreignKey?: {
      table: string;
      column: string;
    };
    unique?: boolean;
    autoIncrement?: boolean;
  }>;
  indexes?: string[];
  rowCount?: number;
  size?: string;
}

export function SQLTab() {
  const [activeConnection, setActiveConnection] = useState<DatabaseConnection | null>(null);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [activeTab, setActiveTab] = useState('connections');

  // Handle connection selection
  const handleConnectionSelect = useCallback((connection: DatabaseConnection) => {
    setActiveConnection(connection);
    if (connection.isConnected) {
      setActiveTab('schema');
    }
  }, []);

  // Handle table selection from schema visualizer
  const handleTableSelect = useCallback((table: Table) => {
    setSelectedTable(table);
    // Could auto-generate a SELECT query for the selected table
  }, []);

  // Handle schema refresh
  const handleSchemaRefresh = useCallback(() => {
    // Refresh schema data
    console.log('Refreshing schema for connection:', activeConnection?.name);
  }, [activeConnection]);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-bolt-elements-textPrimary">
            SQL Database Management
          </h1>
          <p className="text-bolt-elements-textSecondary mt-1">
            Manage database connections, explore schemas, and execute queries
          </p>
        </div>
        {activeConnection && (
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${
              activeConnection.isConnected ? 'bg-green-500' : 'bg-gray-400'
            }`} />
            <span className="text-sm font-medium text-bolt-elements-textPrimary">
              {activeConnection.name}
            </span>
            <Badge variant={activeConnection.isConnected ? 'default' : 'outline'}>
              {activeConnection.type.toUpperCase()}
            </Badge>
          </div>
        )}
      </div>

      {/* Connection Status Banner */}
      {!activeConnection && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="i-ph:info text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">
                  No database connection active
                </p>
                <p className="text-sm text-blue-700">
                  Create or select a database connection to start managing your data
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="connections">
            <div className="i-ph:database mr-2" />
            Connections
          </TabsTrigger>
          <TabsTrigger value="schema" disabled={!activeConnection?.isConnected}>
            <div className="i-ph:tree-structure mr-2" />
            Schema
            {selectedTable && (
              <Badge variant="secondary" className="ml-2">
                {selectedTable.name}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="query" disabled={!activeConnection?.isConnected}>
            <div className="i-ph:terminal-window mr-2" />
            Query Builder
          </TabsTrigger>
          <TabsTrigger value="tools" disabled={!activeConnection?.isConnected}>
            <div className="i-ph:wrench mr-2" />
            Tools
          </TabsTrigger>
        </TabsList>

        {/* Database Connections Tab */}
        <TabsContent value="connections" className="space-y-6">
          <SQLiteManager
            onConnectionSelect={handleConnectionSelect}
            onSchemaChange={handleSchemaRefresh}
          />
        </TabsContent>

        {/* Database Schema Tab */}
        <TabsContent value="schema" className="space-y-6">
          {activeConnection?.isConnected ? (
            <DatabaseSchemaVisualizer
              onRefresh={handleSchemaRefresh}
              onTableSelect={handleTableSelect}
            />
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="i-ph:database text-4xl text-bolt-elements-textSecondary mb-4 mx-auto" />
                <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-2">
                  No active connection
                </h3>
                <p className="text-bolt-elements-textSecondary">
                  Connect to a database to view its schema
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Query Builder Tab */}
        <TabsContent value="query" className="space-y-6">
          {activeConnection?.isConnected ? (
            <SQLQueryBuilder
              connectionName={activeConnection.name}
            />
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="i-ph:terminal-window text-4xl text-bolt-elements-textSecondary mb-4 mx-auto" />
                <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-2">
                  No active connection
                </h3>
                <p className="text-bolt-elements-textSecondary">
                  Connect to a database to execute queries
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Database Tools Tab */}
        <TabsContent value="tools" className="space-y-6">
          {activeConnection?.isConnected ? (
            <div className="grid gap-6">
              {/* Import/Export Tools */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-bolt-elements-textPrimary mb-2">
                        Import / Export
                      </h3>
                      <p className="text-bolt-elements-textSecondary">
                        Import data from CSV files or export database to various formats
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                        Import CSV
                      </button>
                      <button className="px-4 py-2 border border-bolt-elements-borderColor rounded-lg hover:bg-bolt-elements-background-depth-1 transition-colors">
                        Export Database
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Database Backup */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-bolt-elements-textPrimary mb-2">
                        Backup & Restore
                      </h3>
                      <p className="text-bolt-elements-textSecondary">
                        Create database backups and restore from previous backups
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                        Create Backup
                      </button>
                      <button className="px-4 py-2 border border-bolt-elements-borderColor rounded-lg hover:bg-bolt-elements-background-depth-1 transition-colors">
                        Restore
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Database Optimization */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-bolt-elements-textPrimary mb-2">
                        Database Optimization
                      </h3>
                      <p className="text-bolt-elements-textSecondary">
                        Analyze and optimize database performance
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                        Analyze
                      </button>
                      <button className="px-4 py-2 border border-bolt-elements-borderColor rounded-lg hover:bg-bolt-elements-background-depth-1 transition-colors">
                        Optimize
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Migration Tools */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-bolt-elements-textPrimary mb-2">
                        Database Migrations
                      </h3>
                      <p className="text-bolt-elements-textSecondary">
                        Create and manage database schema migrations
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors">
                        Create Migration
                      </button>
                      <button className="px-4 py-2 border border-bolt-elements-borderColor rounded-lg hover:bg-bolt-elements-background-depth-1 transition-colors">
                        Run Pending
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="i-ph:wrench text-4xl text-bolt-elements-textSecondary mb-4 mx-auto" />
                <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-2">
                  No active connection
                </h3>
                <p className="text-bolt-elements-textSecondary">
                  Connect to a database to access database tools
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Quick Stats Footer */}
      {activeConnection?.isConnected && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <div className="i-ph:table text-green-600" />
                  <span className="text-sm font-medium text-green-900">
                    {activeConnection.tables?.length || 0} Tables
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="i-ph:database text-green-600" />
                  <span className="text-sm font-medium text-green-900">
                    {activeConnection.type.toUpperCase()}
                  </span>
                </div>
                {activeConnection.lastConnected && (
                  <div className="flex items-center space-x-2">
                    <div className="i-ph:clock text-green-600" />
                    <span className="text-sm font-medium text-green-900">
                      Connected {activeConnection.lastConnected.toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
              <Badge className="bg-green-100 text-green-800">
                Active Connection
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}