/**
 * Mock de integración con sistema externo de pago (issue #28).
 *
 * En producción esto sería una integración con un proveedor real (Stripe,
 * MercadoPago, Webpay, etc.). Por ahora simulamos:
 *   - Una latencia realista (300-800ms) como si llamáramos a un API externo
 *   - Un fallo aleatorio (~10%) para que el frontend pueda manejar errores
 *
 * Si querés forzar éxito o fallo durante desarrollo, podés pisar SHOULD_FAIL_RATE
 * vía variable de entorno PAYMENT_FAIL_RATE (0..1).
 */

export interface PaymentRequest {
    userId: string;
    activityId: string;
    /** Monto en CLP (opcional, solo informativo en el mock). */
    amount?: number;
}

export interface PaymentResult {
    success: boolean;
    /** ID único de la transacción (mock). */
    transactionId?: string;
    /** Mensaje de error si success=false. */
    error?: string;
    /** Timestamp ISO del intento de cobro. */
    processedAt: string;
}

const SHOULD_FAIL_RATE = Number(process.env.PAYMENT_FAIL_RATE ?? "0.1");

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function randomLatencyMs(): number {
    return 300 + Math.floor(Math.random() * 500);
}

function randomTxnId(): string {
    // formato "TXN-<timestamp>-<6 hex>"
    const random = Math.random().toString(16).slice(2, 8).toUpperCase();
    return `TXN-${Date.now()}-${random}`;
}

/**
 * Procesa un cobro mock. Devuelve una promesa que resuelve con éxito o fallo
 * según el ratio configurado.
 */
export async function processPayment(req: PaymentRequest): Promise<PaymentResult> {
    await sleep(randomLatencyMs());

    if (Math.random() < SHOULD_FAIL_RATE) {
        return {
            success: false,
            error: "Pago rechazado por el proveedor externo (simulado)",
            processedAt: new Date().toISOString(),
        };
    }

    return {
        success: true,
        transactionId: randomTxnId(),
        processedAt: new Date().toISOString(),
    };
}
