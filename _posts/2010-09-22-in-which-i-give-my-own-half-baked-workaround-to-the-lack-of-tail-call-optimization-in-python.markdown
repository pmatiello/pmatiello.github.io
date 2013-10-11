---
layout: post
title:  "In which I give my own half-baked workaround to the lack of tail call optimization in Python"
date:   2010-09-22 12:00:00
categories: python tail-call-optimization
---

A <span style="font-style:italic;">tail call</span> is a function call such that it is the last action performed by a procedure. Therefore, the value returned by the caller procedure is the value returned by the called procedure. Many compilers and interpreters take advantage of this situation by using the caller's stack space to execute the called procedure, instead of allocating more space for it. Because no extra space is consumed by these calls, recursive tail calls can be nested at will without risk of overflowing the stack.

Unfortunately, Python's interpreter does not perform this optimization trick. This can be easily learned from the example bellow:

{% highlight python %}
>>> def f(x):
...     if (x>0): return f(x-1)
...     else: return 0
...
>>> f(10)
0
>>> f(1000)
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
  File "<stdin>", line 2, in f
  ...
  File "<stdin>", line 2, in f
RuntimeError: maximum recursion depth exceeded
{% endhighlight %}

This limitation in the interpreter is unlikely to disappear anytime soon, <a href="http://neopythonic.blogspot.com/2009/04/tail-recursion-elimination.html">if at all</a>. But, as tail call optimization is often very convenient, many <a href="http://code.activestate.com/recipes/474088/">workarounds</a> <a href="http://code.activestate.com/recipes/496691/">were</a> <a href="http://lambda-the-ultimate.org/node/1331#comment-15165">written</a>. These workarounds, with different levels of success, make use of <a href="http://www.artima.com/weblogs/viewpost.jsp?thread=240808">decorators</a> (which are functions that are executed before the decorated function) to control the execution of function calls.

This post presents yet another solution, also based on decorators. The objective here is to avoid any limit on the number of recursive tail calls performed by a function by decorating it like bellow.

{% highlight python %}
@tail_recursive
def f(x):
    if (x>0): return f(x-1)
    else: return 0
{% endhighlight %}

Every call to `f`, then, will be intercepted by the decorator. Depending on the situation, it may continue and execute the function as usual, or return an object that may be used to perform the issued call later. The next listing presents the class for these objects (note that they store both a reference to a function and the arguments for a specific call).

{% highlight python %}
class _continue(object):

    def __init__(self, func, *args, **kwargs):
        self.func = func
        self.args = args
        self.kwargs = kwargs
{% endhighlight %}

Each call to a decorated function `f` implies on a independent run of the decorator code. On the first call, the decorator will allow `f` to be executed, but instead of returning immediately, it will await for `_continue` objects to execute them. Subsequent tail-recursive calls to `f`, on the other hand, will just return an instance of `_continue` filled with the call arguments without executing `f`. Non tail-recursive are allowed to proceed unmolested.

This approach keeps the stack from growing by avoiding nested calls whenever possible. Still, detecting recursion and tail recursion are tricky jobs. The former is performed by checking if penultimate frame in the stack refers to our decorator. The later is performed by <a href="http://lambda-the-ultimate.org/node/1331#comment-15183">checking</a> whether the <a href="http://docs.python.org/release/2.7/library/dis.html#bytecodes">bytecode</a> associated with the previous stack frame will return immediately after the completion of the call.

The source code for the decorator follows. An instance of it is produced for each decorated function, and the method `__call__` is executed on every invocation of them.

{% highlight python %}
OPCODES = [chr(opmap['RETURN_VALUE']), chr(opmap['POP_TOP'])]

class tail_recursive(object):

    def __init__(self, function):
        self.function = function

    def _is_tailcall(self, frame):
        caller_frame = frame.f_back
        code = caller_frame.f_code.co_code
        ip = caller_frame.f_lasti
        return code[ip + 3] in OPCODES

    def __call__(self, *args, **kwargs):

        frame = getframe()

        if frame.f_back and \
            frame.f_back.f_back and \
            frame.f_back.f_back.f_code == frame.f_code and \
            self._is_tailcall(frame):
            return _continue(self.function, *args, **kwargs)

        retval = self.function(*args, **kwargs)
        while (True):
            if (type(retval) == _continue):
                retval = retval.func(*retval.args, **retval.kwargs)
            else:
                return retval
{% endhighlight %}

(The entire code, with tests, is available <a href="http://bitbucket.org/pmatiello/tail-recursion">here</a>.)

Of course, this isn't true tail call optimization, but only a trick to achieve unlimited tail recursion. Properly implemented, the optimization should also provide increased performance by reducing the work needed to perform a function call; here, performance is actually harmed.
