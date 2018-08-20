---
layout: post
title:  "Implementing interface contracts in Python with class decorators"
date:   2012-03-23 12:00:00
categories: interfaces python
---

Python decorators are quite useful and interesting. I've already written about <a href="http://www.artima.com/weblogs/viewpost.jsp?thread=240808">function decorators</a> in a <a href="/2010/09/in-which-i-give-my-own-half-baked-workaround-to-the-lack-of-tail-call-optimization-in-python.html">previous post</a> and <a href="http://www.python.org/dev/peps/pep-3129/">class decorators</a> are a worthy followup.

I order to illustrate this feature, we'll implement support for interface contracts for Python classes. In a language like Java, for instance, a contract can be declared this way:

{% highlight java %}
public interface Comparable<T> {
    public int compareTo(T o);
}
{% endhighlight %}

And a class declared as an implementation of this interface must provide the relevant methods (with the correct signature). Otherwise, a compilation error arises. For instance:

{% highlight java %}
public final class Integer extends Number implements Comparable<Integer> {

    ...

    public int compareTo(Integer anotherInteger) {
        int thisVal = this.value;
        int anotherVal = anotherInteger.value;
        return (thisVal&lt;anotherVal ? -1 : (thisVal==anotherVal ? 0 : 1));
    }

    ...

}
{% endhighlight %}

We'll try to achieve a similar feature in Python, albeit with some limitations. First, as Python does not have an explicit compilation step, our errors will only arise in runtime. Second, in Python, the types of the arguments and return values aren't present in the signature of methods, so we'll leave it out too. This is a notable absence, but we can still verify the presence of desired methods in the implementer type and the following elements in the method's signature:

<ul>
    <li>Name</li>
    <li>Number of arguments</li>
    <li>Name of arguments (as Python supports named parameters)</li>
    <li>Default values for arguments (as Python supports default arguments)</li>
    <li>Support for variadic functions (indefinite number of arguments)</li>
</ul>

This said, we now have to declare our interfaces. I picked the following (somewhat cumbersome) syntax:

{% highlight python %}
class some_interface(interface):
    simple_method = method(['self'])
    method_with_args = method(['self', 'arg1', 'arg2'])
    method_with_varargs = method(['self'], varargs='varargs')
    method_with_kwargs = method(['self'], keywords='kwargs')
    method_with_default_argument = method(['self', 'default_arg'], defaults=1)
{% endhighlight %}

Here we have an ordinary class subtyping an `interface` class. The methods are defined as attributes of the `some_interface` class, holding instances of the `method` class.

The `interface` class isn't really exciting or even necessary. Actually, it exists for the sole purpose of tagging an interface contract as such:

{% highlight python %}
class interface(object):
    pass
{% endhighlight %}

The `method` class holds the method signature.

{% highlight python %}
class method(object):
    def __init__(self, args=None, varargs=None, keywords=None, defaults=0):
        self.args = args or []
        self.varargs = varargs
        self.keywords = keywords
        self.defaults = defaults
{% endhighlight %}

Notice that the constructor takes a few arguments:

<ul>
    <li>`args` — the list of arguments</li>
    <li>`varargs` — the name of the list holding extra arguments, if any</li>
    <li>`kwargs` — the name of the dictionary holding extra named arguments, if any</li>
    <li>`defaults` — the number of arguments with a default value</li>
</ul>

Now we can create a new type implementing `some_interface`. And it follows:

{% highlight python %}
@implements(some_interface)
class some_class(object):

    def simple_method(self):
        pass

    def method_with_args(self, arg):
        pass

    def method_with_varargs(self, *varargs):
        pass

    def method_with_kwargs(self, **kwargs):
        pass

    def method_with_default_argument(self, default_arg=100):
        pass
{% endhighlight %}

Notice that we declare the class as implementing the contract through the `implements` class decorator.

First thing we have to observe is the initialization of the `implements` decorator. Once the decorated class is loaded by the interpreter, an instance of the decorator is produced. The argument `some_interface` is passed to the constructor during the initialization (and it's stored as an attribute for future reference).

{% highlight python %}
class implements(object):

    def __init__(self, interface):
        self.interface = interface

    ...
{% endhighlight %}

Then, the `__call__` method of the decorator is invoked. The decorated class (`some_class` in this example) is passed as argument. In this method, it is verified whether the given class satisfies all of its contractual obligations. If no problem arises, the class is returned at the end of the call.

{% highlight python %}
class implements(object):

    ...

    def __call__(self, clazz):
        methods = [each for each in dir(self.interface) if self._is_method(each)]
        for each in methods:
            self._assert_implements(clazz, each)
        return clazz

    ...
{% endhighlight %}

Notice that the `_assert_implements` method is called against each method declared in the interface. This method, listed ahead, verifies whether the given method, as implemented by the class, has the desired signature, as specified in the interface. In case it doesn't, an exception is raised (effectively interrupting the program).

{% highlight python %}
class implements(object):

    ...

    def _assert_implements(self, clazz, method_name):
        method_contract = object.__getattribute__(self.interface, method_name)
        method_impl = getargspec(object.__getattribute__(clazz, method_name))
        assert method_name in dir(clazz)
        assert method_contract.args == method_impl.args
        assert method_contract.varargs == method_impl.varargs
        assert method_contract.keywords == method_impl.keywords
        if (method_impl.defaults is not None):
            assert method_contract.defaults == len(method_impl.defaults)
        else:
            assert method_contract.defaults == 0

    ...
{% endhighlight %}

The `object.__getattribute__()` (<a href="http://docs.python.org/reference/datamodel.html#object.__getattribute__">documentation</a>) call is one thing worth of note as it is part of Python's introspection features and targeted at retrieving attributes from classes and objects. Here, it's used both to retrieve `method` objects from the interface and and to obtain references to the actual methods in the concrete class (the `clazz` argument).

The `getargspec` function (<a href="http://docs.python.org/library/inspect.html#inspect.getargspec">documentation</a>) is also an interesting introspection feature. Given a function, it will return an object with information about the given function's signature.

So, having both the expected signature from the `method` object hosted in the interface and the signature of the method implemented in the concrete class, we can simply compare them both and hope for a match.

(<strong>Postscript:</strong> although the source code presented above works fine, it's actually a shorter version of the code originally developed for the purpose and available <a href="https://github.com/pmatiello/python-interface">here</a>.)
