/* eslint-disable no-underscore-dangle */
// import type { QuickSQLite } from 'react-native-quick-sqlite';
import * as SQLite from 'expo-sqlite';
// let sqlite: typeof QuickSQLite;

try {
  // sqlite = require('react-native-quick-sqlite')?.QuickSQLite;
} catch (e) {
  // Failed for one of the reason
  // 1. Running on expo, where we don't support offline storage yet.
  // 2. Offline support is disabled, in which case this library is not installed.
}

import { DB_LOCATION, DB_NAME, DB_STATUS_ERROR } from './constants';
import { tables } from './schema';
import { createCreateTableQuery } from './sqlite-utils/createCreateTableQuery';
import type { PreparedQueries, Table } from './types';

/**
 * QuickSqliteClient takes care of any direct interaction with sqlite.
 * This way usage react-native-quick-sqlite package is scoped to a single class/file.
 */
export class QuickSqliteClient {
  static db: SQLite.WebSQLDatabase;

  static dbVersion = 2;

  static dbName = DB_NAME;
  static dbLocation = DB_LOCATION;

  static getDbVersion = () => this.dbVersion;
  // Force a specific db version. This is mainly useful for testsuit.
  static setDbVersion = (version: number) => (this.dbVersion = version);

  static openDB = () => {
    // const { message, status } = sqlite.open(this.dbName, this.dbLocation);
    this.db = SQLite.openDatabase(this.dbName);
    
    // sqlite.executeSql(this.dbName, `PRAGMA foreign_keys = ON`, []);
    this.db.transaction((tx) => {
      tx.executeSql(`PRAGMA foreign_keys = ON`)
    })

    // if (status === DB_STATUS_ERROR) {
    //   console.error(`Error opening database ${this.dbName}: ${message}`);
    // }
  };

  static closeDB = () => {
    // const { message, status } = sqlite.open(this.dbName, this.dbLocation);
    this.db.closeAsync();

    // if (status === DB_STATUS_ERROR) {
    //   console.error(`Error opening database ${this.dbName}: ${message}`);
    // }
  };

  static executeSqlBatch = (queries: PreparedQueries[]) => {
    this.openDB();

    // const res = sqlite.executeSqlBatch(DB_NAME, queries);
    this.db.exec(queries, false, () => {});

    // if (res.status === 1) {
    //   console.error(`Query/queries failed: ${res.message} ${JSON.stringify(res)}`);
    // }

    this.closeDB();
  };

  static executeSql = (query: string, params?: string[]) => {
    console.log('executeSql: start')
    this.openDB();

    // const { message, rows, status } = sqlite.executeSql(DB_NAME, query, params);
    this.db.transaction((tx) => {
      tx.executeSql(query, params, (transaction, resultSet) => {
        console.log('executeSql: executed with rows ', resultSet.rows._array)
        this.closeDB();

        if(resultSet.rows) {
          return resultSet.rows._array
        } else {
          return []
        }
      })
    }, () => {
      this.closeDB();
      return [];
    })
    
    // this.closeDB();

    // if (status === 1) {
    //   console.error(`Query/queries failed: ${message}: `, query);
    // }

    // return rows ? rows._array : [];
  };

  static dropTables = () => {
    const queries: PreparedQueries[] = Object.keys(tables).map((table) => [
      `DROP TABLE IF EXISTS ${table}`,
      [],
    ]);

    this.executeSqlBatch(queries);
  };

  static deleteDatabase = () => {
    // const { message, status } = sqlite.delete(this.dbName, this.dbLocation);
    this.db.deleteAsync();

    // if (status === DB_STATUS_ERROR) {
    //   throw new Error(`Error deleting DB: ${message}`);
    // }

    return true;
  };

  static initializeDatabase = () => {
    // @ts-ignore
    if (sqlite === undefined) {
      throw new Error(
        'Please install "react-native-quick-sqlite" package to enable offline support',
      );
    }

    const version = this.getUserPragmaVersion();

    if (version !== this.dbVersion) {
      this.dropTables();
      this.updateUserPragmaVersion(this.dbVersion);
    }
    const q = (Object.keys(tables) as Table[]).reduce<PreparedQueries[]>(
      (queriesSoFar, tableName) => {
        queriesSoFar.push(...createCreateTableQuery(tableName));
        return queriesSoFar;
      },
      [],
    );

    this.executeSqlBatch(q);
  };

  static updateUserPragmaVersion = (version: number) => {
    this.openDB();

    // sqlite.executeSql(DB_NAME, `PRAGMA user_version = ${version}`, []);
    this.executeSql(`PRAGMA user_version = ${version}`)

    this.closeDB();
  };

  static getUserPragmaVersion = () => {
    console.log('getUserPragmaVersion: openDB')
    this.openDB();

    console.log('getUserPragmaVersion: executeSql')
    // const { message, rows, status } = sqlite.executeSql(DB_NAME, `PRAGMA user_version`, []);
    const rows = this.executeSql(`PRAGMA user_version`)
    console.log('getUserPragmaVersion: rows ', rows)

    this.closeDB();
    // if (status === 1) {
    //   console.error(`Querying for user_version failed: ${message}`);
    // }
    console.log('getUserPragmaVersion: wrapping up')
    const result = rows ? rows : [];
    return result[0].user_version as number;
  };

  static resetDB = () => {
    this.dropTables();
    this.initializeDatabase();
  };
}
