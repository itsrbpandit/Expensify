///
/// Contact.swift
/// This file was generated by nitrogen. DO NOT MODIFY THIS FILE.
/// https://github.com/mrousavy/nitro
/// Copyright © 2024 Marc Rousavy @ Margelo
///

import NitroModules

/**
 * Represents an instance of `Contact`, backed by a C++ struct.
 */
public typealias Contact = margelo.nitro.contacts.Contact

public extension Contact {
  private typealias bridge = margelo.nitro.contacts.bridge.swift

  /**
   * Create a new instance of `Contact`.
   */
  init(firstName: String?, lastName: String?, middleName: String?, phoneNumbers: [StringHolder]?, emailAddresses: [StringHolder]?, imageData: String?, thumbnailImageData: String?) {
    self.init({ () -> bridge.std__optional_std__string_ in
      if let actualValue = firstName {
        return bridge.create_std__optional_std__string_(std.string(actualValue))
      } else {
        return .init()
      }
    }(), { () -> bridge.std__optional_std__string_ in
      if let actualValue = lastName {
        return bridge.create_std__optional_std__string_(std.string(actualValue))
      } else {
        return .init()
      }
    }(), { () -> bridge.std__optional_std__string_ in
      if let actualValue = middleName {
        return bridge.create_std__optional_std__string_(std.string(actualValue))
      } else {
        return .init()
      }
    }(), { () -> bridge.std__optional_std__vector_StringHolder__ in
      if let actualValue = phoneNumbers {
        return bridge.create_std__optional_std__vector_StringHolder__({ () -> bridge.std__vector_StringHolder_ in
          var vector = bridge.create_std__vector_StringHolder_(actualValue.count)
          for item in actualValue {
            vector.push_back(item)
          }
          return vector
        }())
      } else {
        return .init()
      }
    }(), { () -> bridge.std__optional_std__vector_StringHolder__ in
      if let actualValue = emailAddresses {
        return bridge.create_std__optional_std__vector_StringHolder__({ () -> bridge.std__vector_StringHolder_ in
          var vector = bridge.create_std__vector_StringHolder_(actualValue.count)
          for item in actualValue {
            vector.push_back(item)
          }
          return vector
        }())
      } else {
        return .init()
      }
    }(), { () -> bridge.std__optional_std__string_ in
      if let actualValue = imageData {
        return bridge.create_std__optional_std__string_(std.string(actualValue))
      } else {
        return .init()
      }
    }(), { () -> bridge.std__optional_std__string_ in
      if let actualValue = thumbnailImageData {
        return bridge.create_std__optional_std__string_(std.string(actualValue))
      } else {
        return .init()
      }
    }())
  }

  var firstName: String? {
    @inline(__always)
    get {
      return { () -> String? in
        if let actualValue = self.__firstName.value {
          return String(actualValue)
        } else {
          return nil
        }
      }()
    }
    @inline(__always)
    set {
      self.__firstName = { () -> bridge.std__optional_std__string_ in
        if let actualValue = newValue {
          return bridge.create_std__optional_std__string_(std.string(actualValue))
        } else {
          return .init()
        }
      }()
    }
  }
  
  var lastName: String? {
    @inline(__always)
    get {
      return { () -> String? in
        if let actualValue = self.__lastName.value {
          return String(actualValue)
        } else {
          return nil
        }
      }()
    }
    @inline(__always)
    set {
      self.__lastName = { () -> bridge.std__optional_std__string_ in
        if let actualValue = newValue {
          return bridge.create_std__optional_std__string_(std.string(actualValue))
        } else {
          return .init()
        }
      }()
    }
  }
  
  var middleName: String? {
    @inline(__always)
    get {
      return { () -> String? in
        if let actualValue = self.__middleName.value {
          return String(actualValue)
        } else {
          return nil
        }
      }()
    }
    @inline(__always)
    set {
      self.__middleName = { () -> bridge.std__optional_std__string_ in
        if let actualValue = newValue {
          return bridge.create_std__optional_std__string_(std.string(actualValue))
        } else {
          return .init()
        }
      }()
    }
  }
  
  var phoneNumbers: [StringHolder]? {
    @inline(__always)
    get {
      return { () -> [StringHolder]? in
        if let actualValue = self.__phoneNumbers.value {
          return actualValue.map({ val in val })
        } else {
          return nil
        }
      }()
    }
    @inline(__always)
    set {
      self.__phoneNumbers = { () -> bridge.std__optional_std__vector_StringHolder__ in
        if let actualValue = newValue {
          return bridge.create_std__optional_std__vector_StringHolder__({ () -> bridge.std__vector_StringHolder_ in
            var vector = bridge.create_std__vector_StringHolder_(actualValue.count)
            for item in actualValue {
              vector.push_back(item)
            }
            return vector
          }())
        } else {
          return .init()
        }
      }()
    }
  }
  
  var emailAddresses: [StringHolder]? {
    @inline(__always)
    get {
      return { () -> [StringHolder]? in
        if let actualValue = self.__emailAddresses.value {
          return actualValue.map({ val in val })
        } else {
          return nil
        }
      }()
    }
    @inline(__always)
    set {
      self.__emailAddresses = { () -> bridge.std__optional_std__vector_StringHolder__ in
        if let actualValue = newValue {
          return bridge.create_std__optional_std__vector_StringHolder__({ () -> bridge.std__vector_StringHolder_ in
            var vector = bridge.create_std__vector_StringHolder_(actualValue.count)
            for item in actualValue {
              vector.push_back(item)
            }
            return vector
          }())
        } else {
          return .init()
        }
      }()
    }
  }
  
  var imageData: String? {
    @inline(__always)
    get {
      return { () -> String? in
        if let actualValue = self.__imageData.value {
          return String(actualValue)
        } else {
          return nil
        }
      }()
    }
    @inline(__always)
    set {
      self.__imageData = { () -> bridge.std__optional_std__string_ in
        if let actualValue = newValue {
          return bridge.create_std__optional_std__string_(std.string(actualValue))
        } else {
          return .init()
        }
      }()
    }
  }
  
  var thumbnailImageData: String? {
    @inline(__always)
    get {
      return { () -> String? in
        if let actualValue = self.__thumbnailImageData.value {
          return String(actualValue)
        } else {
          return nil
        }
      }()
    }
    @inline(__always)
    set {
      self.__thumbnailImageData = { () -> bridge.std__optional_std__string_ in
        if let actualValue = newValue {
          return bridge.create_std__optional_std__string_(std.string(actualValue))
        } else {
          return .init()
        }
      }()
    }
  }
}
