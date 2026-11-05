import Contacts
import Foundation

/// Names from the address book, to show who wrote instead of the number.
struct ContactBook: Sendable {
	struct Entry: Hashable, Sendable {
		var name: String
		var number: String
	}

	/// Every phone number of every named contact, in address book order.
	private(set) var entries: [Entry] = []
	private var names: [String: String] = [:]

	func name(for number: String) -> String? {
		let key = Formatting.contactKey(number)
		return key.isEmpty ? nil : names[key]
	}

	/// Up to five contacts whose name or number contains the text, for the recipient field.
	func suggestions(for text: String) -> [Entry] {
		guard !text.isEmpty else { return [] }
		return Array(entries.lazy.filter { $0.name.localizedCaseInsensitiveContains(text) || $0.number.contains(text) }.prefix(5))
	}

	static var isAuthorized: Bool {
		[.authorized, .limited].contains(CNContactStore.authorizationStatus(for: .contacts))
	}

	static func requestAccess() async -> Bool {
		(try? await CNContactStore().requestAccess(for: .contacts)) ?? false
	}

	/// Off the main thread: enumerating the address book can take a while.
	static func load() async -> ContactBook {
		guard isAuthorized else { return ContactBook() }
		return await Task.detached(priority: .utility) {
			var book = ContactBook()
			let keys = [CNContactFormatter.descriptorForRequiredKeys(for: .fullName), CNContactPhoneNumbersKey as CNKeyDescriptor]
			let request = CNContactFetchRequest(keysToFetch: keys)
			try? CNContactStore().enumerateContacts(with: request) { contact, _ in
				guard let name = CNContactFormatter.string(from: contact, style: .fullName), !name.isEmpty else { return }
				for phone in contact.phoneNumbers {
					let number = phone.value.stringValue
					let key = Formatting.contactKey(number)
					if !key.isEmpty { book.names[key] = name }
					book.entries.append(Entry(name: name, number: number))
				}
			}
			return book
		}.value
	}
}
