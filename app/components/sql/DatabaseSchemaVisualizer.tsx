import { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '~/components/ui/Card';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';
import { Badge } from '~/components/ui/Badge';
import { Collapsible } from '~/components/ui/Collapsible';
import { SearchInput } from '~/components/ui/SearchInput';

interface Column {
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
}

interface Table {
  name: string;
  columns: Column[];
  indexes?: string[];
  rowCount?: number;
  size?: string;
}

interface DatabaseSchema {
  name: string;
  tables: Table[];
  views?: string[];
  functions?: string[];
}

interface DatabaseSchemaVisualizerProps {
  schema?: DatabaseSchema;
  isLoading?: boolean;
  onRefresh?: () => void;
  onTableSelect?: (table: Table) => void;
}

// Mock schema data for demonstration
const mockSchema: DatabaseSchema = {
  name: 'production_db',
  tables: [
    {
      name: 'users',
      columns: [
        { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true, autoIncrement: true },
        { name: 'email', type: 'VARCHAR(255)', nullable: false, unique: true },
        { name: 'username', type: 'VARCHAR(100)', nullable: false, unique: true },
        { name: 'password_hash', type: 'VARCHAR(255)', nullable: false },
        { name: 'first_name', type: 'VARCHAR(100)', nullable: true },
        { name: 'last_name', type: 'VARCHAR(100)', nullable: true },
        { name: 'created_at', type: 'TIMESTAMP', nullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
        { name: 'updated_at', type: 'TIMESTAMP', nullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
        { name: 'is_active', type: 'BOOLEAN', nullable: false, defaultValue: 'true' }
      ],
      rowCount: 1250,
      size: '2.1 MB'
    },
    {
      name: 'posts',
      columns: [
        { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true, autoIncrement: true },
        { name: 'user_id', type: 'INTEGER', nullable: false, foreignKey: { table: 'users', column: 'id' } },
        { name: 'title', type: 'VARCHAR(255)', nullable: false },
        { name: 'content', type: 'TEXT', nullable: true },
        { name: 'slug', type: 'VARCHAR(255)', nullable: false, unique: true },
        { name: 'status', type: 'VARCHAR(20)', nullable: false, defaultValue: 'draft' },
        { name: 'published_at', type: 'TIMESTAMP', nullable: true },
        { name: 'created_at', type: 'TIMESTAMP', nullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
        { name: 'updated_at', type: 'TIMESTAMP', nullable: false, defaultValue: 'CURRENT_TIMESTAMP' }
      ],
      rowCount: 3420,
      size: '8.7 MB'
    },
    {
      name: 'comments',
      columns: [
        { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true, autoIncrement: true },
        { name: 'post_id', type: 'INTEGER', nullable: false, foreignKey: { table: 'posts', column: 'id' } },
        { name: 'user_id', type: 'INTEGER', nullable: false, foreignKey: { table: 'users', column: 'id' } },
        { name: 'content', type: 'TEXT', nullable: false },
        { name: 'parent_id', type: 'INTEGER', nullable: true, foreignKey: { table: 'comments', column: 'id' } },
        { name: 'created_at', type: 'TIMESTAMP', nullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
        { name: 'updated_at', type: 'TIMESTAMP', nullable: false, defaultValue: 'CURRENT_TIMESTAMP' }
      ],
      rowCount: 12890,
      size: '4.2 MB'
    },
    {
      name: 'categories',
      columns: [
        { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true, autoIncrement: true },
        { name: 'name', type: 'VARCHAR(100)', nullable: false, unique: true },
        { name: 'slug', type: 'VARCHAR(100)', nullable: false, unique: true },
        { name: 'description', type: 'TEXT', nullable: true },
        { name: 'created_at', type: 'TIMESTAMP', nullable: false, defaultValue: 'CURRENT_TIMESTAMP' }
      ],
      rowCount: 25,
      size: '12 KB'
    }
  ],
  views: ['user_posts_view', 'recent_comments_view'],
  functions: ['update_timestamp', 'calculate_post_stats']
};

export function DatabaseSchemaVisualizer({ 
  schema = mockSchema, 
  isLoading = false, 
  onRefresh,
  onTableSelect 
}: DatabaseSchemaVisualizerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  // Filter tables based on search term
  const filteredTables = useMemo(() => {
    if (!searchTerm) return schema.tables;
    return schema.tables.filter(table => 
      table.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      table.columns.some(col => col.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [schema.tables, searchTerm]);

  // Toggle table expansion
  const toggleTableExpansion = (tableName: string) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName);
    } else {
      newExpanded.add(tableName);
    }
    setExpandedTables(newExpanded);
  };

  // Select table
  const handleTableSelect = (table: Table) => {
    setSelectedTable(table.name);
    onTableSelect?.(table);
  };

  // Get column type badge color
  const getColumnTypeBadge = (type: string) => {
    if (type.includes('VARCHAR') || type.includes('TEXT')) return 'bg-blue-100 text-blue-800';
    if (type.includes('INTEGER') || type.includes('BIGINT')) return 'bg-green-100 text-green-800';
    if (type.includes('TIMESTAMP') || type.includes('DATE')) return 'bg-purple-100 text-purple-800';
    if (type.includes('BOOLEAN')) return 'bg-orange-100 text-orange-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-bolt-elements-textPrimary">
            Database Schema
          </h2>
          <p className="text-sm text-bolt-elements-textSecondary mt-1">
            {schema.name} • {schema.tables.length} tables
          </p>
        </div>
        <Button onClick={onRefresh} disabled={isLoading}>
          <div className={`i-ph:arrow-clockwise mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Search */}
      <SearchInput
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Search tables and columns..."
      />

      {/* Schema Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <div className="i-ph:table text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-bolt-elements-textPrimary">
                  {schema.tables.length}
                </p>
                <p className="text-sm text-bolt-elements-textSecondary">Tables</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <div className="i-ph:eye text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-bolt-elements-textPrimary">
                  {schema.views?.length || 0}
                </p>
                <p className="text-sm text-bolt-elements-textSecondary">Views</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <div className="i-ph:function text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-bolt-elements-textPrimary">
                  {schema.functions?.length || 0}
                </p>
                <p className="text-sm text-bolt-elements-textSecondary">Functions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tables List */}
      <div className="space-y-4">
        {filteredTables.map((table) => (
          <Card 
            key={table.name} 
            className={`transition-all ${
              selectedTable === table.name ? 'ring-2 ring-blue-500' : ''
            }`}
          >
            <CardHeader 
              className="cursor-pointer hover:bg-bolt-elements-background-depth-1"
              onClick={() => handleTableSelect(table)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="i-ph:table text-bolt-elements-textSecondary" />
                  <div>
                    <CardTitle className="text-lg">{table.name}</CardTitle>
                    <div className="flex items-center space-x-4 text-sm text-bolt-elements-textSecondary">
                      <span>{table.columns.length} columns</span>
                      {table.rowCount && <span>{table.rowCount.toLocaleString()} rows</span>}
                      {table.size && <span>{table.size}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">{table.columns.length} cols</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTableExpansion(table.name);
                    }}
                  >
                    <div className={`i-ph:caret-${expandedTables.has(table.name) ? 'up' : 'down'}`} />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <Collapsible isOpen={expandedTables.has(table.name)}>
              <CardContent className="pt-0">
                <div className="border-t border-bolt-elements-borderColor pt-4">
                  <div className="space-y-2">
                    {table.columns.map((column) => (
                      <div 
                        key={column.name}
                        className="flex items-center justify-between p-3 bg-bolt-elements-background-depth-1 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 bg-bolt-elements-background-depth-2 rounded flex items-center justify-center">
                            {column.primaryKey && <div className="i-ph:key text-yellow-500 text-xs" />}
                            {column.foreignKey && <div className="i-ph:link text-blue-500 text-xs" />}
                            {!column.primaryKey && !column.foreignKey && (
                              <div className="i-ph:columns text-bolt-elements-textSecondary text-xs" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-bolt-elements-textPrimary">
                              {column.name}
                            </p>
                            {column.foreignKey && (
                              <p className="text-xs text-bolt-elements-textSecondary">
                                References {column.foreignKey.table}.{column.foreignKey.column}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Badge className={getColumnTypeBadge(column.type)}>
                            {column.type}
                          </Badge>
                          {column.nullable && (
                            <Badge variant="outline" className="text-xs">NULL</Badge>
                          )}
                          {column.unique && (
                            <Badge variant="outline" className="text-xs">UNIQUE</Badge>
                          )}
                          {column.autoIncrement && (
                            <Badge variant="outline" className="text-xs">AUTO</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Collapsible>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredTables.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="i-ph:database text-4xl text-bolt-elements-textSecondary mb-4 mx-auto" />
            <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-2">
              No tables found
            </h3>
            <p className="text-bolt-elements-textSecondary">
              {searchTerm ? 'Try adjusting your search criteria' : 'No tables in this database'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}