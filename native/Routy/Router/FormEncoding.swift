import Foundation

/// Parameters encoded exactly as the Expo app sends them, which the router is known to accept.
/// `URLComponents` would leave `+` as is, and the router would read the `+` of "+39…" as a space.
enum FormEncoding {
	/// A GET query, as axios serializes `params`.
	static func query(_ pairs: [(String, String)]) -> String {
		pairs.map { "\(queryComponent($0))=\(queryComponent($1))" }.joined(separator: "&")
	}

	/// A POST body, as React Native's `URLSearchParams.toString()` serializes it.
	static func body(_ pairs: [(String, String)]) -> String {
		pairs.map { "\(bodyComponent($0))=\(bodyComponent($1))" }.joined(separator: "&")
	}

	/// JavaScript's `encodeURIComponent`.
	static func encodeURIComponent(_ value: String) -> String {
		value.addingPercentEncoding(withAllowedCharacters: unreserved) ?? value
	}

	private static let unreserved = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~*'()")

	private static func bodyComponent(_ value: String) -> String {
		encodeURIComponent(value).replacingOccurrences(of: "%20", with: "+")
	}

	/// axios's `buildURL` encoder: `:`, `$` and `,` stay readable, a space is `+`.
	private static func queryComponent(_ value: String) -> String {
		var encoded = encodeURIComponent(value)
		for (escape, character) in [("%3A", ":"), ("%24", "$"), ("%2C", ","), ("%20", "+")] {
			encoded = encoded.replacingOccurrences(of: escape, with: character)
		}
		return encoded
	}
}
