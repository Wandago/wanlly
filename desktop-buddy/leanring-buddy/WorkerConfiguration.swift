//
//  WorkerConfiguration.swift
//  leanring-buddy
//
//  Where the Cloudflare Worker lives, and the shared app token added to every
//  request sent to it.
//  The Worker rejects requests without it, so a leaked Worker URL can't be
//  used by strangers to spend your Anthropic / ElevenLabs / AssemblyAI credits.
//
//  This token ships inside the app binary, so it stops casual abuse but not a
//  determined attacker. Per-user sign-in plus per-user rate limits on the
//  Worker is the real fix once the app has accounts.
//

import Foundation

enum WorkerConfiguration {
    /// Set `WorkerBaseURL` in Info.plist to your deployed Worker URL.
    static let workerBaseURL = AppBundleConfiguration.stringValue(forKey: "WorkerBaseURL")
        ?? "https://your-worker-name.your-subdomain.workers.dev"

    static let appTokenHeaderName = "X-App-Token"

    static func addAppTokenHeader(to request: inout URLRequest) {
        guard let workerAppToken = AppBundleConfiguration.stringValue(forKey: "WorkerAppToken") else {
            return
        }
        request.setValue(workerAppToken, forHTTPHeaderField: appTokenHeaderName)
    }
}
