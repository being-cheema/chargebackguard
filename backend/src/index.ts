import { app } from './app';
import { getDb } from './db';

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  try {
    // Initialize DB schema
    await getDb();

    app.listen(PORT, () => {
      console.log(`\n======================================================`);
      console.log(`🛡️  ChargebackGuard Backend API is running on port ${PORT}`);
      console.log(`📍 Health Check: http://localhost:${PORT}/health`);
      console.log(`📊 Metrics API:  http://localhost:${PORT}/api/metrics`);
      console.log(`🔍 Disputes API: http://localhost:${PORT}/api/disputes`);
      console.log(`======================================================\n`);
    });
  } catch (err: any) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

bootstrap();
