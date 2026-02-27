const { Pool } = require("pg");

const pgPool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

// Event listeners pour gérer les erreurs
pgPool.on("error", (err) => {
  console.error("Erreur non gérée dans le pool PostgreSQL:", err);
});

/**
 * Adaptateur pour converter la syntaxe MySQL (? comme placeholders)
 * en syntaxe PostgreSQL ($1, $2, etc.)
 * Également convertit le format de réponse pour compatibilité
 */
class PoolAdapter {
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * Convertit les ? en $1, $2, $3, etc.
   */
  convertQuery(sql) {
    let paramIndex = 1;
    return sql.replace(/\?/g, () => `$${paramIndex++}`);
  }

  /**
   * Wrap la méthode query pour convertir le format
   */
  async query(sql, params = []) {
    const convertedSql = this.convertQuery(sql);

    try {
      const result = await this.pool.query(convertedSql, params);

      // Retourne un tableau [rows, result] pour compatibilité avec mysql2
      return [result.rows, result];
    } catch (error) {
      console.error("Erreur PostgreSQL:", error);
      throw error;
    }
  }

  /**
   * Pour les transactions
   */
  async getConnection() {
    const client = await this.pool.connect();

    return {
      query: async (sql, params = []) => {
        const convertedSql = this.convertQuery(sql);
        const result = await client.query(convertedSql, params);
        return [result.rows, result];
      },
      beginTransaction: async () => {
        await client.query("BEGIN");
      },
      commit: async () => {
        await client.query("COMMIT");
      },
      rollback: async () => {
        await client.query("ROLLBACK");
      },
      release: () => {
        client.release();
      },
    };
  }

}

const pool = new PoolAdapter(pgPool);

module.exports = pool;
