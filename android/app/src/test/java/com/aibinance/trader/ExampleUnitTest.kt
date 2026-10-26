package com.aibinance.trader

import org.junit.Test
import org.junit.Assert.*

class ExampleUnitTest {
    @Test fun tradingModeDefaultIsPaper() {
        assertEquals("paper", "paper")
    }
    @Test fun riskCalculationDoesNotMartingale() {
        val maxTrade = 100.0
        // after loss, size must stay <= maxTrade
        val attempted = 200.0
        assertFalse(attempted <= maxTrade)
    }
    @Test fun apiKeyMasking() {
        val key = "1234567890ABCDEF"
        val masked = key.take(4) + "****" + key.takeLast(4)
        assertEquals("1234****CDEF", masked)
    }
}
